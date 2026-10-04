import unittest
from fractions import Fraction
from pathlib import Path

from evaluate_model import precision_at_k_per_snapshot
from train_risk_model import (
    EXCLUDED_FEATURES,
    FEATURE_COLUMNS,
    EXPECTED_SPLIT_COUNTS,
    build_feature_matrix,
    fit_model,
    labels_from_rows,
    load_split_records,
)


class TrainRiskModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.train_rows, cls.test_rows, cls.split_config = load_split_records()
        cls.train_features = build_feature_matrix(cls.train_rows)
        cls.train_labels = labels_from_rows(cls.train_rows)

    def test_repository_split_is_disjoint_and_matches_config(self):
        train_repositories = {row["repo_url"] for row in self.train_rows}
        test_repositories = {row["repo_url"] for row in self.test_rows}
        configured_train = set(self.split_config["train_repositories"])
        configured_test = set(self.split_config["test_repositories"])
        self.assertTrue(train_repositories.isdisjoint(test_repositories))
        self.assertEqual(train_repositories, configured_train)
        self.assertEqual(test_repositories, configured_test)

    def test_feature_matrix_excludes_forbidden_columns_by_name(self):
        feature_matrix = build_feature_matrix(self.train_rows + self.test_rows)
        self.assertEqual(list(feature_matrix.columns), list(FEATURE_COLUMNS))
        for excluded in EXCLUDED_FEATURES:
            with self.subTest(excluded=excluded):
                self.assertNotIn(excluded, feature_matrix.columns)

    def test_feature_matrix_row_counts_match_approved_split(self):
        test_features = build_feature_matrix(self.test_rows)
        counts = {
            "train_rows": len(self.train_features),
            "train_positives": int(self.train_labels.sum()),
            "test_rows": len(test_features),
            "test_positives": sum(int(row["label"]) for row in self.test_rows),
        }
        self.assertEqual(counts, EXPECTED_SPLIT_COUNTS)

    def test_fitted_model_uses_balanced_class_weight(self):
        model = fit_model(self.train_features, self.train_labels)
        classifier = model.named_steps["logistic_regression"]
        self.assertIsNotNone(classifier.coef_)
        self.assertEqual(classifier.class_weight, "balanced")

    def test_precision_at_k_is_averaged_per_snapshot(self):
        rows = [
            {"repo_url": "repo-a", "snapshot_commit": "snap-1", "label": "1"},
            {"repo_url": "repo-a", "snapshot_commit": "snap-1", "label": "0"},
            {"repo_url": "repo-a", "snapshot_commit": "snap-1", "label": "1"},
            {"repo_url": "repo-b", "snapshot_commit": "snap-2", "label": "0"},
            {"repo_url": "repo-b", "snapshot_commit": "snap-2", "label": "1"},
        ]
        probabilities = [0.90, 0.80, 0.70, 0.95, 0.10]
        result = precision_at_k_per_snapshot(rows, probabilities, k=3)
        self.assertEqual(result, float((Fraction(2, 3) + Fraction(1, 2)) / 2))


if __name__ == "__main__":
    unittest.main()