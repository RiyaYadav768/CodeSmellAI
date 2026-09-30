import os
import unittest
from unittest.mock import patch

from ai_insights import (
    _EXPLANATION_CACHE,
    add_explanations,
    fallback_explanation,
    generate_explanation,
    select_facts,
)


def sample_row():
    return {
        "filename": "app.py",
        "risk_score": 80.0,
        "risk_category": "High Risk",
        "pagerank_contribution": 1.0,
        "cyclomatic_complexity_contribution": 15.0,
        "smell_count_total_contribution": 12.0,
        "loc_contribution": 4.0,
        "smell_breakdown": {"deep_nesting": 13, "long_function": 1},
        "bug_fix_commit_count": 5,
        "has_insufficient_history": False,
        "maintainability_index": 0,
    }


class AIInsightsTests(unittest.TestCase):
    def setUp(self):
        _EXPLANATION_CACHE.clear()

    def test_fact_selection_ranks_contributions_and_smells(self):
        facts = select_facts(sample_row())
        self.assertEqual(
            [name for name, _ in facts["top_contributions"]],
            ["cyclomatic_complexity", "smell_count_total", "loc"],
        )
        self.assertEqual(facts["smells"], [("deep_nesting", 13), ("long_function", 1)])
        self.assertIn("notable bug-fix history (5 bug-fix commits)", facts["facts"])

    def test_top_three_cutoff_includes_all_tied_leaders(self):
        row = sample_row()
        row.update(
            {
                "cyclomatic_complexity_contribution": 20.0,
                "smell_count_total_contribution": 15.0,
                "bug_fix_commit_count_contribution": 15.0,
                "loc_contribution": 15.0,
                "pagerank_contribution": 1.0,
            }
        )
        selected = select_facts(row)
        self.assertEqual(
            selected["top_contributions"],
            [
                ("cyclomatic_complexity", 20.0),
                ("bug_fix_commit_count", 15.0),
                ("loc", 15.0),
                ("smell_count_total", 15.0),
            ],
        )
        explanation = fallback_explanation(row, selected)
        self.assertIn("bug_fix_commit_count (15.00 points)", explanation)

    def test_fallback_is_non_empty_and_formatted(self):
        explanation = fallback_explanation(sample_row(), select_facts(sample_row()))
        self.assertIn("app.py scored 80.0 (High Risk)", explanation)
        self.assertIn("cyclomatic_complexity", explanation)

    def test_missing_key_pipeline_produces_explanations(self):
        with patch.dict(os.environ, {}, clear=True):
            rows = add_explanations([sample_row()])
        self.assertTrue(rows[0]["ai_explanation"])

    def test_cache_skips_second_api_call(self):
        with patch.dict(os.environ, {"AI_INSIGHTS_API_KEY": "test-key"}):
            with patch("ai_insights._call_llm", return_value="AI explanation") as call:
                self.assertEqual(generate_explanation(sample_row()), "AI explanation")
                self.assertEqual(generate_explanation(sample_row()), "AI explanation")
                self.assertEqual(call.call_count, 1)

    def test_cache_key_changes_when_selected_facts_change(self):
        first_row = sample_row()
        second_row = {**first_row, "loc_contribution": 9.0}
        with patch.dict(os.environ, {"AI_INSIGHTS_API_KEY": "test-key"}):
            with patch(
                "ai_insights._call_llm",
                side_effect=["First explanation", "Second explanation"],
            ) as call:
                self.assertEqual(generate_explanation(first_row), "First explanation")
                self.assertEqual(generate_explanation(second_row), "Second explanation")
                self.assertEqual(call.call_count, 2)

    def test_rows_are_unchanged_except_explanation(self):
        row = sample_row()
        original = row.copy()
        result = add_explanations([row])[0]
        result.pop("ai_explanation")
        self.assertEqual(result, original)


if __name__ == "__main__":
    unittest.main()