"""Evaluate the standalone Phase 7b logistic regression model."""

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import average_precision_score, f1_score, precision_score, recall_score

from train_risk_model import (
    DATASET_PATH,
    MODEL_PATH,
    SPLIT_CONFIG_PATH,
    build_feature_matrix,
    labels_from_rows,
    load_split_records,
)


TOP_K_VALUES = (5, 10, 20)


def precision_at_k_per_snapshot(rows, probabilities, k):
    if k <= 0:
        raise ValueError("k must be positive")
    if len(rows) != len(probabilities):
        raise ValueError("Rows and probabilities must have equal lengths")
    if not rows:
        raise ValueError("Cannot calculate precision@K for no rows")

    snapshots = {}
    for index, row in enumerate(rows):
        key = (row["repo_url"], row["snapshot_commit"])
        snapshots.setdefault(key, []).append(index)

    snapshot_precisions = []
    for indices in snapshots.values():
        ranked = sorted(indices, key=lambda index: -probabilities[index])
        selected = ranked[:k]
        positives = sum(int(rows[index]["label"]) == 1 for index in selected)
        snapshot_precisions.append(positives / len(selected))
    return float(np.mean(snapshot_precisions))


def evaluate_rows(rows, probabilities):
    labels = labels_from_rows(rows)
    predictions = (np.asarray(probabilities) >= 0.5).astype(int)
    metrics = {
        "row_count": len(rows),
        "positive_count": int(labels.sum()),
        "precision_at_0_5": float(precision_score(labels, predictions, zero_division=0)),
        "recall_at_0_5": float(recall_score(labels, predictions, zero_division=0)),
        "f1_at_0_5": float(f1_score(labels, predictions, zero_division=0)),
        "pr_auc_average_precision": float(average_precision_score(labels, probabilities)),
        "precision_at_k_per_snapshot": {
            str(k): precision_at_k_per_snapshot(rows, probabilities, k)
            for k in TOP_K_VALUES
        },
    }
    return metrics


def build_evaluation_report(test_rows, test_features, model, test_repositories):
    probabilities = model.predict_proba(test_features)[:, 1]
    report = {
        "threshold": 0.5,
        "pr_auc_definition": "scikit-learn average_precision_score",
        "precision_at_k_aggregation": (
            "Within each (repo_url, snapshot_commit), rank files by predicted "
            "probability, compute precision among the top min(K, snapshot size), "
            "then take the unweighted mean across snapshots."
        ),
        "aggregate": evaluate_rows(test_rows, probabilities),
        "repositories": {},
    }
    for repository in test_repositories:
        indices = [
            index
            for index, row in enumerate(test_rows)
            if row["repo_url"] == repository
        ]
        repository_rows = [test_rows[index] for index in indices]
        repository_features = test_features.iloc[indices]
        repository_probabilities = model.predict_proba(repository_features)[:, 1]
        report["repositories"][repository] = evaluate_rows(
            repository_rows, repository_probabilities
        )
    return report


def evaluate_and_save(
    dataset_path=DATASET_PATH,
    split_config_path=SPLIT_CONFIG_PATH,
    model_path=MODEL_PATH,
    report_path=None,
):
    _, test_rows, split_config = load_split_records(dataset_path, split_config_path)
    test_features = build_feature_matrix(test_rows)
    model = joblib.load(model_path)
    report = build_evaluation_report(
        test_rows, test_features, model, split_config["test_repositories"]
    )
    rendered = json.dumps(report, indent=2) + "\n"
    if report_path is not None:
        Path(report_path).write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=DATASET_PATH)
    parser.add_argument("--split-config", type=Path, default=SPLIT_CONFIG_PATH)
    parser.add_argument("--model", type=Path, default=MODEL_PATH)
    parser.add_argument("--output", type=Path, default=Path("evaluation_report.json"))
    arguments = parser.parse_args()
    evaluate_and_save(
        arguments.dataset,
        arguments.split_config,
        arguments.model,
        arguments.output,
    )


if __name__ == "__main__":
    main()