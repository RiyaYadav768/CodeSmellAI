import csv
import subprocess
import sys
import unittest
from pathlib import Path


class PipelineTests(unittest.TestCase):
    def test_phase_one_columns_and_phase_two_rows(self):
        project_root = Path(__file__).parent
        subprocess.run(
            [sys.executable, "main.py"],
            cwd=project_root,
            check=True,
            capture_output=True,
            text=True,
        )

        with (project_root / "metrics.csv").open(newline="") as csv_file:
            rows = list(csv.DictReader(csv_file))

        self.assertEqual(
            {row["filename"] for row in rows},
            {"app.py", "auth.py", "database.py", "payment.py"},
        )
        required_columns = {
            "filename",
            "degree",
            "in_degree",
            "pagerank",
            "cyclomatic_complexity",
            "loc",
            "function_count",
            "class_count",
            "max_nesting_depth",
            "smell_count_total",
            "smell_breakdown",
            "maintainability_index",
            "commit_count",
            "bug_fix_commit_count",
            "distinct_author_count",
            "days_since_last_modified",
            "has_insufficient_history",
            "risk_score",
            "risk_category",
            "pagerank_contribution",
            "cyclomatic_complexity_contribution",
            "smell_count_total_contribution",
            "max_nesting_depth_contribution",
            "loc_contribution",
            "structural_size_contribution",
            "ai_explanation",
        }
        self.assertTrue(required_columns.issubset(rows[0]))

        app = next(row for row in rows if row["filename"] == "app.py")
        self.assertEqual(app["degree"], "3")
        self.assertEqual(app["in_degree"], "0")
        self.assertEqual(app["loc"], "77")
        self.assertNotEqual(app["maintainability_index"], "")
        self.assertNotEqual(app["risk_score"], "")
        self.assertNotEqual(app["ai_explanation"], "")
        self.assertIn(app["risk_category"], {"Low Risk", "Medium Risk", "High Risk"})
        for row in rows:
            self.assertNotEqual(row["ai_explanation"], "")
            for column in (
                "commit_count",
                "bug_fix_commit_count",
                "distinct_author_count",
                "days_since_last_modified",
                "has_insufficient_history",
            ):
                self.assertNotEqual(row[column], "")

        scores = {float(row["risk_score"]) for row in rows}
        self.assertGreater(len(scores), 1)


if __name__ == "__main__":
    unittest.main()