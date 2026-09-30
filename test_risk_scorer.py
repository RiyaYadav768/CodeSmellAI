import unittest

from risk_scorer import (
    MEDIUM_RISK_THRESHOLD,
    LOW_RISK_THRESHOLD,
    aggregate_risk,
    categorize_risk,
    normalize_values,
    score_metrics,
)


def metric_row(name, value, maintainability_index=50):
    return {
        "filename": name,
        "pagerank": value,
        "cyclomatic_complexity": value,
        "loc": value,
        "max_nesting_depth": value,
        "smell_count_total": value,
        "function_count": value,
        "class_count": 0,
        "maintainability_index": maintainability_index,
    }


class RiskScorerTests(unittest.TestCase):
    def test_normalization_and_zero_variance(self):
        self.assertEqual(normalize_values([10, 20, 30]), [0.0, 0.5, 1.0])
        self.assertEqual(normalize_values([7, 7]), [0.0, 0.0])
        self.assertEqual(normalize_values([None, "bad"]), [0.0, 0.0])

    def test_weighted_formula(self):
        rows = [metric_row("low", 0), metric_row("high", 10)]
        scored = score_metrics(rows)
        self.assertEqual(scored[0]["risk_score"], 0.0)
        self.assertEqual(scored[1]["risk_score"], 70.0)
        self.assertEqual(scored[1]["pagerank_contribution"], 15.0)
        self.assertEqual(scored[1]["structural_size_contribution"], 5.0)

    def test_category_boundaries(self):
        self.assertEqual(categorize_risk(LOW_RISK_THRESHOLD - 0.01), "Low Risk")
        self.assertEqual(categorize_risk(LOW_RISK_THRESHOLD), "Medium Risk")
        self.assertEqual(categorize_risk(MEDIUM_RISK_THRESHOLD - 0.01), "Medium Risk")
        self.assertEqual(categorize_risk(MEDIUM_RISK_THRESHOLD), "High Risk")

    def test_maintainability_is_not_a_scoring_input(self):
        first = score_metrics([metric_row("same", 1, 10)])[0]
        second = score_metrics([metric_row("same", 1, 90)])[0]
        self.assertEqual(first["risk_score"], second["risk_score"])
        self.assertEqual(second["maintainability_index"], 90)

    def test_aggregate_risk(self):
        rows = score_metrics([metric_row("a", 0), metric_row("b", 10)])
        summary = aggregate_risk(rows)
        self.assertEqual(summary["category_counts"]["Low Risk"], 1)
        self.assertEqual(summary["category_counts"]["High Risk"], 1)
        self.assertEqual(summary["top_10_by_risk_score"][0]["filename"], "b")


if __name__ == "__main__":
    unittest.main()