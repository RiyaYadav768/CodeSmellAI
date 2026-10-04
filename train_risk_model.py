"""Train the Phase 7b repository-held-out logistic regression baseline."""

import ast
import csv
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "training_dataset.csv"
SPLIT_CONFIG_PATH = ROOT / "split_config.json"
MODEL_PATH = ROOT / "trained_model.joblib"
METADATA_PATH = ROOT / "model_metadata.json"

BASE_FEATURES = (
    "pagerank",
    "cyclomatic_complexity",
    "loc",
    "function_count",
    "class_count",
    "max_nesting_depth",
    "smell_count_total",
)
SMELL_FEATURES = (
    "long_function",
    "too_many_parameters",
    "deep_nesting",
    "large_file",
    "god_class",
)
FEATURE_COLUMNS = BASE_FEATURES + SMELL_FEATURES
EXCLUDED_FEATURES = (
    "maintainability_index",
    "risk_score",
    "risk_category",
    "commit_count",
    "bug_fix_commit_count",
    "distinct_author_count",
)
EXPECTED_SPLIT_COUNTS = {
    "train_rows": 532,
    "train_positives": 68,
    "test_rows": 579,
    "test_positives": 124,
}


def _normalize_csv_row(row):
    return {
        key.strip().lstrip("\ufeff").strip('"'): (
            value.strip().strip('"') if value is not None else ""
        )
        for key, value in row.items()
        if key is not None
    }


def load_dataset_rows(dataset_path=DATASET_PATH):
    with Path(dataset_path).open(newline="", encoding="utf-8-sig") as dataset_file:
        return [
            _normalize_csv_row(row)
            for row in csv.DictReader(dataset_file)
        ]


def load_split_records(dataset_path=DATASET_PATH, split_config_path=SPLIT_CONFIG_PATH):
    rows = load_dataset_rows(dataset_path)
    with Path(split_config_path).open(encoding="utf-8") as config_file:
        split_config = json.load(config_file)

    train_repositories = set(split_config["train_repositories"])
    test_repositories = set(split_config["test_repositories"])
    if train_repositories & test_repositories:
        raise ValueError("A repository appears in both configured splits")

    dataset_repositories = {row["repo_url"] for row in rows}
    if dataset_repositories != train_repositories | test_repositories:
        raise ValueError("Split config repositories do not match the dataset")

    train_rows = [row for row in rows if row["repo_url"] in train_repositories]
    test_rows = [row for row in rows if row["repo_url"] in test_repositories]
    return train_rows, test_rows, split_config


def assert_no_excluded_features(feature_matrix):
    present = set(feature_matrix.columns) & set(EXCLUDED_FEATURES)
    if present:
        raise AssertionError(f"Excluded columns found in feature matrix: {sorted(present)}")


def build_feature_matrix(rows):
    feature_rows = []
    for row in rows:
        smell_breakdown = ast.literal_eval(row["smell_breakdown"])
        if not isinstance(smell_breakdown, dict):
            raise ValueError("smell_breakdown must contain a dictionary")

        values = {
            feature: float(row[feature])
            for feature in BASE_FEATURES
        }
        for feature in SMELL_FEATURES:
            values[feature] = float(smell_breakdown[feature])
        feature_rows.append(values)

    feature_matrix = pd.DataFrame(feature_rows, columns=FEATURE_COLUMNS)
    assert_no_excluded_features(feature_matrix)
    return feature_matrix


def labels_from_rows(rows):
    return np.asarray([int(row["label"]) for row in rows], dtype=int)


def fit_model(feature_matrix, labels):
    model = Pipeline(
        [
            ("standard_scaler", StandardScaler()),
            (
                "logistic_regression",
                LogisticRegression(
                    class_weight="balanced",
                    max_iter=1000,
                    random_state=42,
                ),
            ),
        ]
    )
    model.fit(feature_matrix, labels)
    return model


def coefficient_report(model):
    classifier = model.named_steps["logistic_regression"]
    coefficients = {
        name: float(value)
        for name, value in zip(FEATURE_COLUMNS, classifier.coef_[0])
    }
    absolute_values = np.abs(list(coefficients.values()))
    median_absolute = float(np.median(absolute_values))
    largest_absolute = float(np.max(absolute_values))
    magnitude_ratio = (
        largest_absolute / median_absolute if median_absolute else float("inf")
    )
    magnitude_outlier = magnitude_ratio >= 5.0
    return {
        "coefficients": coefficients,
        "largest_to_median_absolute_ratio": magnitude_ratio,
        "magnitude_outlier_threshold": "largest absolute coefficient >= 5x median absolute coefficient",
        "magnitude_outlier_flag": magnitude_outlier,
        "stability_observation": (
            "A single fitted coefficient vector cannot quantify sampling stability; "
            "interpret coefficients cautiously with 68 positive training examples."
        ),
    }


def train_and_save(
    dataset_path=DATASET_PATH,
    split_config_path=SPLIT_CONFIG_PATH,
    model_path=MODEL_PATH,
    metadata_path=METADATA_PATH,
):
    train_rows, test_rows, split_config = load_split_records(
        dataset_path, split_config_path
    )
    train_features = build_feature_matrix(train_rows)
    train_labels = labels_from_rows(train_rows)
    test_labels = labels_from_rows(test_rows)

    counts = {
        "train_rows": len(train_rows),
        "train_positives": int(train_labels.sum()),
        "test_rows": len(test_rows),
        "test_positives": int(test_labels.sum()),
    }
    if counts != EXPECTED_SPLIT_COUNTS:
        raise ValueError(
            f"Dataset split counts differ from the approved split: {counts}"
        )

    model = fit_model(train_features, train_labels)
    report = coefficient_report(model)
    joblib.dump(model, model_path)
    metadata = {
        "features": list(FEATURE_COLUMNS),
        "split_config": Path(split_config_path).name,
        "train_repositories": split_config["train_repositories"],
        "test_repositories": split_config["test_repositories"],
        "class_weight": "balanced",
        "model": "sklearn.pipeline.Pipeline(StandardScaler, LogisticRegression)",
        "logistic_regression_parameters": {
            "C": 1.0,
            "solver": "lbfgs",
            "max_iter": 1000,
            "random_state": 42,
        },
        "scikit_learn_version": sklearn.__version__,
        "counts": counts,
        "coefficient_report": report,
    }
    Path(metadata_path).write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )

    print("Fitted coefficients (standardized features):")
    for name, value in report["coefficients"].items():
        print(f"  {name}: {value:.8f}")
    print(
        "Coefficient magnitude outlier flag: "
        f"{report['magnitude_outlier_flag']} "
        f"(largest/median |coefficient| = "
        f"{report['largest_to_median_absolute_ratio']:.3f}; "
        f"threshold = 5x)"
    )
    print(report["stability_observation"])
    return model, metadata


if __name__ == "__main__":
    train_and_save()