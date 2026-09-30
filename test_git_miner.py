import os
import tempfile
import unittest
from git import Actor, Repo

from git_miner import (
    INSUFFICIENT_HISTORY_THRESHOLD,
    is_bug_fix_message,
    mine_git_metrics,
)
from risk_scorer import score_metrics


def commit(repo, path, content, message, author):
    full_path = os.path.join(repo.working_tree_dir, path)
    with open(full_path, "w") as file:
        file.write(content)
    repo.index.add([path])
    repo.index.commit(message, author=author, committer=author)


class GitMinerTests(unittest.TestCase):
    def test_bug_fix_keyword_matching(self):
        self.assertTrue(is_bug_fix_message("Patch checkout issue"))
        self.assertTrue(is_bug_fix_message("HOTFIX: handle timeout"))
        self.assertFalse(is_bug_fix_message("Add checkout feature"))

    def test_counts_authors_and_insufficient_history(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Repo.init(directory)
            alice = Actor("Alice", "alice@example.com")
            bob = Actor("Bob", "bob@example.com")
            commit(repo, "service.py", "one\n", "initial", alice)
            commit(repo, "service.py", "two\n", "fix service", bob)
            result = mine_git_metrics(directory, [os.path.join(directory, "service.py")])
            metrics = result["service.py"]
            self.assertEqual(metrics["commit_count"], 2)
            self.assertEqual(metrics["bug_fix_commit_count"], 1)
            self.assertEqual(metrics["distinct_author_count"], 2)
            self.assertTrue(metrics["has_insufficient_history"])
            self.assertEqual(metrics["commit_count"] < INSUFFICIENT_HISTORY_THRESHOLD, True)
            self.assertIsInstance(metrics["days_since_last_modified"], int)
            repo.close()

    def test_rename_history_accumulates_under_current_name(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Repo.init(directory)
            author = Actor("Alice", "alice@example.com")
            commit(repo, "old_name.py", "one\ntwo\nthree\nfour\n", "initial", author)
            repo.git.mv("old_name.py", "new_name.py")
            with open(os.path.join(directory, "new_name.py"), "a") as file:
                file.write("two\n")
            repo.index.add(["new_name.py"])
            repo.index.commit("rename service", author=author, committer=author)
            current_path = os.path.join(directory, "new_name.py")
            result = mine_git_metrics(directory, [current_path])
            self.assertEqual(result["new_name.py"]["commit_count"], 2)
            self.assertNotIn("old_name.py", result)
            repo.close()

    def test_days_since_last_modified_does_not_affect_risk(self):
        base = {
            "filename": "service.py",
            "pagerank": 1,
            "cyclomatic_complexity": 1,
            "loc": 1,
            "max_nesting_depth": 1,
            "smell_count_total": 1,
            "function_count": 1,
            "class_count": 1,
            "bug_fix_commit_count": 1,
            "commit_count": 1,
            "distinct_author_count": 1,
            "maintainability_index": 50,
            "days_since_last_modified": 1,
        }
        changed = {**base, "days_since_last_modified": 999}
        self.assertEqual(
            score_metrics([base])[0]["risk_score"],
            score_metrics([changed])[0]["risk_score"],
        )


if __name__ == "__main__":
    unittest.main()