import logging
import os
from datetime import datetime, timezone

from git import InvalidGitRepositoryError, NoSuchPathError, Repo


logger = logging.getLogger(__name__)

BUG_FIX_KEYWORDS = ["fix", "bug", "patch", "hotfix", "issue"]
INSUFFICIENT_HISTORY_THRESHOLD = 3


def normalize_path(repo_path, file_path):
    """Return a normalized repository-relative path."""
    return os.path.relpath(
        os.path.abspath(file_path), os.path.abspath(repo_path)
    ).replace(os.sep, "/")


def is_bug_fix_message(message):
    """Return whether a commit message contains a configured bug keyword."""
    lowered_message = message.lower()
    return any(keyword in lowered_message for keyword in BUG_FIX_KEYWORDS)


def _empty_metrics():
    return {
        "commit_count": 0,
        "bug_fix_commit_count": 0,
        "distinct_author_count": 0,
        "days_since_last_modified": 0,
        "has_insufficient_history": True,
    }


def _resolve_path(path, aliases):
    while path in aliases and aliases[path] != path:
        path = aliases[path]
    return path


def _changed_paths(commit, aliases):
    """Yield old/current paths for one commit using first-parent diffs."""
    if not commit.parents:
        for path in commit.stats.files:
            yield path, _resolve_path(path, aliases)
        return

    # GitPython passes M=True through as Git's -M similarity-based rename flag.
    diffs = commit.diff(commit.parents[0], create_patch=False, M=True)
    for diff in diffs:
        current_path = diff.a_path or diff.b_path
        old_path = diff.b_path or diff.a_path
        if diff.renamed_file:
            aliases[old_path] = _resolve_path(current_path, aliases)
        yield old_path, _resolve_path(current_path, aliases)


def _days_since(timestamp):
    current_time = datetime.now(timezone.utc)
    commit_time = timestamp
    if commit_time.tzinfo is None:
        commit_time = commit_time.replace(tzinfo=timezone.utc)
    return max(0, (current_time - commit_time.astimezone(timezone.utc)).days)


def mine_git_metrics(repo_path, file_paths=None):
    """Mine all file history in one newest-to-oldest commit walk.

    Merge commits count once against their first parent. Different email
    addresses are treated as different authors; no identity resolution occurs.
    Rename detection is best effort and may miss heavily edited renames.
    """
    metrics = {}
    authors_by_file = {}
    aliases = {}

    if file_paths is not None:
        for file_path in file_paths:
            metrics[normalize_path(repo_path, file_path)] = _empty_metrics()

    try:
        repo = Repo(repo_path)
    except (InvalidGitRepositoryError, NoSuchPathError):
        logger.warning("No Git repository found at %s; history is unavailable", repo_path)
        return metrics

    try:
        if repo.git.rev_parse("--is-shallow-repository").strip() == "true":
            logger.warning("Repository %s is shallow; Git history may be incomplete", repo_path)
    except Exception as error:
        logger.warning("Could not determine whether %s is shallow: %s", repo_path, error)

    try:
        for commit in repo.iter_commits():
            is_bug_fix = is_bug_fix_message(commit.message)
            for _, current_path in _changed_paths(commit, aliases):
                file_metrics = metrics.setdefault(current_path, _empty_metrics())
                file_metrics["commit_count"] += 1
                if is_bug_fix:
                    file_metrics["bug_fix_commit_count"] += 1
                authors_by_file.setdefault(current_path, set()).add(
                    commit.author.email or commit.author.name
                )
                if file_metrics["commit_count"] == 1:
                    file_metrics["days_since_last_modified"] = _days_since(
                        commit.committed_datetime
                    )
    except (ValueError, OSError) as error:
        logger.warning("Git history could not be fully read for %s: %s", repo_path, error)

    for file_path, authors in authors_by_file.items():
        metrics[file_path]["distinct_author_count"] = len(authors)

    for file_metrics in metrics.values():
        file_metrics["has_insufficient_history"] = (
            file_metrics["commit_count"] < INSUFFICIENT_HISTORY_THRESHOLD
        )

    return metrics


def merge_git_metrics(metrics, git_metrics):
    """Merge Git metrics into current scanner rows only."""
    return [
        {**row, **git_metrics.get(row["filename"], _empty_metrics())}
        for row in metrics
    ]
