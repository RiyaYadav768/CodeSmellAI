import csv
import tempfile
import unittest
from pathlib import Path

from format_pr_comment import COMMENT_MARKER, format_comment


class FormatPrCommentTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary_directory.name)
        self.metrics_path = self.directory / "metrics.csv"
        self.changed_files_path = self.directory / "changed-files.txt"
        with self.metrics_path.open("w", newline="", encoding="utf-8") as metrics_file:
            writer = csv.DictWriter(
                metrics_file,
                fieldnames=("filename", "risk_score", "risk_category", "ai_explanation"),
            )
            writer.writeheader()
            writer.writerows([
                {
                    "filename": "src/low.py",
                    "risk_score": "12.5",
                    "risk_category": "Low Risk",
                    "ai_explanation": "Low-risk explanation",
                },
                {
                    "filename": "src/medium.py",
                    "risk_score": "55",
                    "risk_category": "Medium Risk",
                    "ai_explanation": "Medium-risk explanation",
                },
                {
                    "filename": "src/high.py",
                    "risk_score": "82",
                    "risk_category": "High Risk",
                    "ai_explanation": "High-risk explanation",
                },
                {
                    "filename": "src/other.py",
                    "risk_score": "90",
                    "risk_category": "High Risk",
                    "ai_explanation": "Not changed",
                },
            ])

    def tearDown(self):
        self.temporary_directory.cleanup()

    def set_changed_files(self, *paths):
        self.changed_files_path.write_text("\n".join(paths) + "\n", encoding="utf-8")

    def test_filters_to_changed_paths_and_includes_marker(self):
        self.set_changed_files("src/low.py", "src/medium.py", "README.md")

        body, has_high_risk = format_comment(self.metrics_path, self.changed_files_path)

        self.assertIn("3 files changed, 1 flagged Medium/High risk", body)
        self.assertIn("src/low.py", body)
        self.assertIn("src/medium.py", body)
        self.assertIn("**WARNING: Medium Risk**", body)
        self.assertNotIn("src/other.py", body)
        self.assertFalse(has_high_risk)
        self.assertTrue(body.startswith(COMMENT_MARKER))

    def test_truncates_details_and_reports_omitted_count(self):
        self.set_changed_files("src/low.py", "src/medium.py", "src/high.py")

        body, has_high_risk = format_comment(
            self.metrics_path, self.changed_files_path, top_n=2
        )

        self.assertIn("src/high.py", body)
        self.assertIn("src/medium.py", body)
        self.assertNotIn("src/low.py", body)
        self.assertIn("...and 1 more files not shown.", body)
        self.assertTrue(has_high_risk)

    def test_notes_changed_file_missing_from_metrics(self):
        self.set_changed_files("src/deleted.py")

        body, has_high_risk = format_comment(self.metrics_path, self.changed_files_path)

        self.assertIn("likely deleted", body)
        self.assertIn("Deleted / unavailable", body)
        self.assertFalse(has_high_risk)

    def test_non_python_changes_have_no_analyzable_files(self):
        self.set_changed_files("README.md", "pyproject.toml")

        body, _ = format_comment(self.metrics_path, self.changed_files_path)

        self.assertIn("No analyzable Python files changed.", body)
        self.assertNotIn("| File |", body)

    def test_marker_is_stable_between_generated_comments(self):
        self.set_changed_files("src/low.py")

        first_body, _ = format_comment(self.metrics_path, self.changed_files_path)
        second_body, _ = format_comment(self.metrics_path, self.changed_files_path)

        self.assertEqual(first_body.splitlines()[0], second_body.splitlines()[0])
        self.assertEqual(first_body.splitlines()[0], "<!-- codesmell-ai-report -->")


if __name__ == "__main__":
    unittest.main()