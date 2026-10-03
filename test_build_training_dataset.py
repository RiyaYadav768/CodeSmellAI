import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from git import Repo

from build_training_dataset import (
    compute_file_label,
    extract_snapshot_features,
    get_post_snapshot_commits,
    has_full_forward_window,
)


class TrainingDatasetTests(unittest.TestCase):
    def _create_history(self, root, include_in_window_fix, include_pre_fix=False,
                        include_after_window_fix=False):
        repo_path = Path(root) / "synthetic"
        repo = Repo.init(repo_path)
        origin = datetime(2024, 1, 1, tzinfo=timezone.utc)

        def commit_file(day, message, contents):
            source = repo_path / "target.py"
            source.write_text(contents, encoding="utf-8")
            repo.index.add(["target.py"])
            commit_time = (origin + timedelta(days=day)).strftime(
                "%Y-%m-%dT%H:%M:%S+0000"
            )
            return repo.index.commit(
                message, author_date=commit_time, commit_date=commit_time
            )

        commit_file(0, "add target", "value = 0\n")
        if include_pre_fix:
            commit_file(5, "fix: historical behavior", "value = 1\n")
        snapshot = commit_file(10, "refactor target", "value = 2\n")
        if include_in_window_fix:
            commit_file(30, "bug: correct target", "value = 3\n")
        if include_after_window_fix:
            commit_file(102, "fix: after the window", "value = 4\n")
        head = commit_file(103, "record end of available history", "value = 5\n")
        return repo, snapshot, head

    def _label_at_snapshot(self, repo, snapshot, head, forward_days=90):
        commits = get_post_snapshot_commits(
            repo,
            snapshot.hexsha,
            head.hexsha,
            snapshot.committed_datetime,
            forward_days,
        )
        return compute_file_label("target.py", commits)

    def test_label_uses_bug_fix_inside_forward_window(self):
        with tempfile.TemporaryDirectory() as root:
            repo, snapshot, head = self._create_history(
                root, include_in_window_fix=True
            )
            self.assertEqual(self._label_at_snapshot(repo, snapshot, head), 1)
            repo.close()

    def test_pre_snapshot_bug_fix_cannot_change_label(self):
        with tempfile.TemporaryDirectory() as root:
            repo, snapshot, head = self._create_history(
                root, include_in_window_fix=False
            )
            baseline = self._label_at_snapshot(repo, snapshot, head)
            self.assertEqual(baseline, 0)
            repo.close()

        with tempfile.TemporaryDirectory() as root:
            repo, snapshot, head = self._create_history(
                root, include_in_window_fix=False, include_pre_fix=True
            )
            self.assertEqual(self._label_at_snapshot(repo, snapshot, head), baseline)
            repo.close()

    def test_bug_fix_after_window_end_cannot_change_label(self):
        with tempfile.TemporaryDirectory() as root:
            repo, snapshot, head = self._create_history(
                root, include_in_window_fix=False
            )
            baseline = self._label_at_snapshot(repo, snapshot, head)
            self.assertEqual(baseline, 0)
            repo.close()

        with tempfile.TemporaryDirectory() as root:
            repo, snapshot, head = self._create_history(
                root,
                include_in_window_fix=False,
                include_after_window_fix=True,
            )
            self.assertEqual(self._label_at_snapshot(repo, snapshot, head), baseline)
            repo.close()

    def test_snapshot_without_full_forward_window_is_excluded(self):
        snapshot_time = datetime(2024, 1, 10, tzinfo=timezone.utc)
        enough_history = [
            type("Commit", (), {"committed_datetime": snapshot_time + timedelta(days=90)})()
        ]
        short_history = [
            type("Commit", (), {"committed_datetime": snapshot_time + timedelta(days=89)})()
        ]
        self.assertTrue(has_full_forward_window(snapshot_time, enough_history, 90))
        self.assertFalse(has_full_forward_window(snapshot_time, short_history, 90))

    def test_feature_cache_skips_second_checkout(self):
        with tempfile.TemporaryDirectory() as root:
            repo_path = Path(root) / "repo"
            cache_dir = Path(root) / "cache"
            repo = Repo.init(repo_path)
            source = repo_path / "app.py"
            source.write_text("def answer():\n    return 42\n", encoding="utf-8")
            repo.index.add(["app.py"])
            snapshot = repo.index.commit("add app")

            class CheckoutCounter:
                def __init__(self, wrapped_repo):
                    self.wrapped_repo = wrapped_repo
                    self.calls = 0
                    self.git = self

                def checkout(self, commit_sha):
                    self.calls += 1
                    return self.wrapped_repo.git.checkout(commit_sha)

            checkout = CheckoutCounter(repo)
            first = extract_snapshot_features(
                checkout,
                repo_path,
                "https://example.test/owner/repo.git",
                snapshot.hexsha,
                cache_dir,
            )
            second = extract_snapshot_features(
                checkout,
                repo_path,
                "https://example.test/owner/repo.git",
                snapshot.hexsha,
                cache_dir,
            )

            self.assertEqual(checkout.calls, 1)
            self.assertEqual(first, second)
            self.assertEqual(first[0]["filename"], "app.py")
            repo.close()


if __name__ == "__main__":
    unittest.main()