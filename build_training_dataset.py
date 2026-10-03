"""Build a historical, leakage-separated CodeSmellAI training dataset.

The default selects up to eight evenly spaced commits from first-parent
history. Each snapshot needs a complete 90-day forward window; labels inspect
only commits in the exclusive Git range after that snapshot whose commit times
fall within that window. Per-snapshot features are cached by repository URL and
commit SHA. Feature extraction sees only the checked-out snapshot, while label
computation receives only already-bounded post-snapshot commits, making
pre-snapshot leakage structurally unavailable. Files deleted during the
forward window remain labelable from matching bug-fix commits before deletion.

The initial real-data run used pypa/sampleproject (a compact packaging example),
pallets/itsdangerous, and pallets/markupsafe (small, established Python
libraries). All three are public, have real dated histories, and are small
enough for a first bounded dataset run.
"""

import argparse
import csv
import hashlib
import json
import logging
import os
import tempfile
from datetime import timedelta, timezone
from pathlib import Path

from git import Repo

from git_miner import BUG_FIX_KEYWORDS
from graph_builder import build_graph
from metrics import calculate_metrics
from parser import extract_imports
from scanner import get_python_files
from smell_detector import analyze_files


logger = logging.getLogger(__name__)

DEFAULT_SNAPSHOTS_PER_REPO = 8
DEFAULT_FORWARD_DAYS = 90
FEATURE_FIELDS = (
    "pagerank",
    "cyclomatic_complexity",
    "loc",
    "function_count",
    "class_count",
    "max_nesting_depth",
    "smell_count_total",
    "smell_breakdown",
    "maintainability_index",
)
CSV_FIELDS = (
    "repo_url",
    "filename",
    "snapshot_commit",
    "snapshot_timestamp",
    *FEATURE_FIELDS,
    "label",
)


def _as_utc(timestamp):
    if timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc)


def sample_snapshots(history, snapshots_per_repo):
    """Select reproducible, evenly spaced commits from oldest to newest."""
    if snapshots_per_repo < 1:
        raise ValueError("snapshots_per_repo must be at least 1")
    if not history:
        return []
    sample_count = min(len(history), snapshots_per_repo)
    if sample_count == 1:
        return [history[(len(history) - 1) // 2]]
    indices = [
        round(index * (len(history) - 1) / (sample_count - 1))
        for index in range(sample_count)
    ]
    return [history[index] for index in indices]


def has_full_forward_window(snapshot_timestamp, post_snapshot_commits, forward_days):
    """Whether post-snapshot commit timestamps cover the entire window."""
    if not post_snapshot_commits:
        return False
    window_end = _as_utc(snapshot_timestamp) + timedelta(days=forward_days)
    latest_timestamp = max(
        _as_utc(commit.committed_datetime) for commit in post_snapshot_commits
    )
    return latest_timestamp >= window_end


def get_post_snapshot_history(repo, snapshot_sha, head_sha):
    """Return commits from the exclusive first-parent range after a snapshot."""
    return list(
        repo.iter_commits(f"{snapshot_sha}..{head_sha}", first_parent=True)
    )


def _filter_forward_window(post_snapshot_commits, snapshot_timestamp, forward_days):
    window_start = _as_utc(snapshot_timestamp)
    window_end = window_start + timedelta(days=forward_days)
    return [
        commit
        for commit in post_snapshot_commits
        if window_start
        <= _as_utc(commit.committed_datetime)
        <= window_end
    ]


def get_post_snapshot_commits(
    repo, snapshot_sha, head_sha, snapshot_timestamp, forward_days
):
    """Return only first-parent commits after the snapshot and inside its window."""
    post_snapshot_history = get_post_snapshot_history(repo, snapshot_sha, head_sha)
    return _filter_forward_window(
        post_snapshot_history, snapshot_timestamp, forward_days
    )


def compute_file_label(filename, post_snapshot_commits):
    """Label a file using only the supplied post-snapshot commit range."""
    for commit in post_snapshot_commits:
        is_bug_fix = any(
            keyword in commit.message.lower() for keyword in BUG_FIX_KEYWORDS
        )
        if is_bug_fix and filename in commit.stats.files:
            return 1
    return 0


def _cache_file(cache_dir, repo_url, commit_sha):
    key = hashlib.sha256(f"{repo_url}\0{commit_sha}".encode("utf-8")).hexdigest()
    return Path(cache_dir) / f"{key}.json"


def extract_snapshot_features(repo, repo_path, repo_url, commit_sha, cache_dir):
    """Load cached features or analyze exactly the checked-out snapshot."""
    cache_path = _cache_file(cache_dir, repo_url, commit_sha)
    if cache_path.exists():
        try:
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            if cached["repo_url"] == repo_url and cached["commit_sha"] == commit_sha:
                return cached["features"]
        except (OSError, ValueError, KeyError, TypeError) as error:
            logger.warning("Ignoring invalid feature cache %s: %s", cache_path, error)

    repo.git.checkout(commit_sha)
    repo_path = os.path.abspath(repo_path)
    python_files = get_python_files(repo_path)
    dependency_map = {}
    for file_path in python_files:
        try:
            dependency_map[os.path.basename(file_path)] = extract_imports(file_path)
        except (OSError, UnicodeError, SyntaxError) as error:
            logger.warning("Skipping %s during import parsing: %s", file_path, error)

    graph_rows = calculate_metrics(build_graph(dependency_map))
    pagerank_by_module = {row["filename"]: row["pagerank"] for row in graph_rows}
    smell_metrics = analyze_files(python_files, repo_path)
    features = []
    for filename, metrics in smell_metrics.items():
        module_name = Path(filename).stem
        features.append(
            {
                "filename": filename,
                "pagerank": pagerank_by_module.get(module_name, 0),
                **{field: metrics[field] for field in FEATURE_FIELDS if field != "pagerank"},
            }
        )

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(
        json.dumps(
            {"repo_url": repo_url, "commit_sha": commit_sha, "features": features},
            sort_keys=True,
        ),
        encoding="utf-8",
    )
    return features


def process_repository(
    repo_url,
    cache_dir,
    snapshots_per_repo=DEFAULT_SNAPSHOTS_PER_REPO,
    forward_days=DEFAULT_FORWARD_DAYS,
):
    """Clone one repository temporarily and return rows plus run statistics."""
    stats = {"sampled": 0, "processed": 0, "excluded_window": 0, "failed": 0}
    rows = []
    with tempfile.TemporaryDirectory(prefix="codesmellai-dataset-") as clone_dir:
        try:
            repo = Repo.clone_from(repo_url, clone_dir)
        except Exception as error:
            logger.warning("Skipping repository %s; clone failed: %s", repo_url, error)
            stats["failed"] += 1
            return rows, stats

        try:
            head_sha = repo.head.commit.hexsha
            history = list(reversed(list(repo.iter_commits(head_sha, first_parent=True))))
            if len(history) < 2:
                logger.warning(
                    "Skipping repository %s; only %d first-parent commit(s), "
                    "not enough history for a snapshot and forward window",
                    repo_url,
                    len(history),
                )
                stats["failed"] += 1
                return rows, stats

            snapshots = sample_snapshots(history, snapshots_per_repo)
            stats["sampled"] = len(snapshots)
            for snapshot in snapshots:
                timestamp = _as_utc(snapshot.committed_datetime)
                post_snapshot_history = get_post_snapshot_history(
                    repo, snapshot.hexsha, head_sha
                )
                if not has_full_forward_window(
                    timestamp, post_snapshot_history, forward_days
                ):
                    stats["excluded_window"] += 1
                    logger.info(
                        "Excluding %s @ %s: full %d-day forward window unavailable",
                        repo_url,
                        snapshot.hexsha[:12],
                        forward_days,
                    )
                    continue

                try:
                    features = extract_snapshot_features(
                        repo,
                        clone_dir,
                        repo_url,
                        snapshot.hexsha,
                        cache_dir,
                    )
                    post_snapshot_commits = _filter_forward_window(
                        post_snapshot_history,
                        timestamp,
                        forward_days,
                    )
                    snapshot_timestamp = timestamp.isoformat().replace("+00:00", "Z")
                    for feature in features:
                        rows.append(
                            {
                                "repo_url": repo_url,
                                "filename": feature["filename"],
                                "snapshot_commit": snapshot.hexsha,
                                "snapshot_timestamp": snapshot_timestamp,
                                **{field: feature[field] for field in FEATURE_FIELDS},
                                "label": compute_file_label(
                                    feature["filename"], post_snapshot_commits
                                ),
                            }
                        )
                    stats["processed"] += 1
                except Exception:
                    stats["failed"] += 1
                    logger.exception(
                        "Skipping failed snapshot %s @ %s",
                        repo_url,
                        snapshot.hexsha[:12],
                    )
        finally:
            repo.close()

    return rows, stats


def write_dataset(rows, output_path):
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def build_dataset(
    repo_urls,
    output_path="training_dataset.csv",
    cache_dir=".training_dataset_cache",
    snapshots_per_repo=DEFAULT_SNAPSHOTS_PER_REPO,
    forward_days=DEFAULT_FORWARD_DAYS,
):
    if not 2 <= len(repo_urls) <= 3:
        raise ValueError("Provide 2 or 3 public repository URLs")

    all_rows = []
    totals = {"sampled": 0, "processed": 0, "excluded_window": 0, "failed": 0}
    for repo_url in repo_urls:
        rows, stats = process_repository(
            repo_url, cache_dir, snapshots_per_repo, forward_days
        )
        all_rows.extend(rows)
        for key in totals:
            totals[key] += stats[key]
        logger.info(
            "Repository summary %s: sampled=%d processed=%d excluded_incomplete_window=%d failed=%d",
            repo_url,
            stats["sampled"],
            stats["processed"],
            stats["excluded_window"],
            stats["failed"],
        )

    write_dataset(all_rows, output_path)
    logger.info(
        "Dataset summary: sampled=%d processed=%d excluded_incomplete_window=%d "
        "failed=%d rows=%d output=%s",
        totals["sampled"],
        totals["processed"],
        totals["excluded_window"],
        totals["failed"],
        len(all_rows),
        output_path,
    )
    return all_rows, totals


def main():
    parser = argparse.ArgumentParser(
        description="Build a leakage-separated historical CodeSmellAI dataset"
    )
    parser.add_argument(
        "--repo",
        action="append",
        required=True,
        help="Public Git repository URL; pass this option 2 or 3 times",
    )
    parser.add_argument(
        "--snapshots-per-repo",
        type=int,
        default=DEFAULT_SNAPSHOTS_PER_REPO,
    )
    parser.add_argument("--forward-days", type=int, default=DEFAULT_FORWARD_DAYS)
    parser.add_argument("--output", default="training_dataset.csv")
    parser.add_argument("--cache-dir", default=".training_dataset_cache")
    args = parser.parse_args()

    if args.forward_days < 1:
        parser.error("--forward-days must be at least 1")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    try:
        build_dataset(
            args.repo,
            args.output,
            args.cache_dir,
            args.snapshots_per_repo,
            args.forward_days,
        )
    except ValueError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()