import math


# Risk configuration. Each metric is min-max normalized against the current
# repository, so very small repositories may produce less stable relative
# rankings; no special percentile handling is applied. Structural size is the
# sum of function_count and class_count, giving one normalized size signal.
# Weights rebalance structural signals with Git behavior: centrality,
# complexity, smells, and bug-fix history are 0.15; nesting, LOC, and commit
# count are 0.10; structural size and distinct authors are 0.05. The
# maintainability_index is deliberately excluded because it combines signals
# already scored here. days_since_last_modified is also intentionally excluded
# because recency is reported for context without adding a second time signal.
WEIGHTED_METRICS = (
    ("pagerank", 0.15),
    ("cyclomatic_complexity", 0.15),
    ("smell_count_total", 0.15),
    ("max_nesting_depth", 0.10),
    ("loc", 0.10),
    ("structural_size", 0.05),
    ("bug_fix_commit_count", 0.15),
    ("commit_count", 0.10),
    ("distinct_author_count", 0.05),
)
LOW_RISK_THRESHOLD = 40
MEDIUM_RISK_THRESHOLD = 70
# Scores below 40 are Low Risk, 40-69.99 are Medium Risk, and 70+ are High Risk.


def _validate_weights():
    total = sum(weight for _, weight in WEIGHTED_METRICS)
    if not math.isclose(total, 1.0, rel_tol=0, abs_tol=1e-9):
        raise ValueError(
            f"Risk metric weights must sum to 1.0; received {total:.6f}"
        )


_validate_weights()


def _number(value):
    try:
        return float(value) if value is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def metric_value(row, metric_name):
    if metric_name == "structural_size":
        return _number(row.get("function_count")) + _number(row.get("class_count"))
    return _number(row.get(metric_name))


def normalize_values(values):
    """Min-max normalize values; zero variance maps to 0.0 by design."""
    numeric_values = [_number(value) for value in values]
    if not numeric_values:
        return []
    minimum = min(numeric_values)
    maximum = max(numeric_values)
    span = maximum - minimum
    # A zero signal carries no relative risk, so equal values contribute zero.
    if span == 0:
        return [0.0] * len(numeric_values)
    return [(value - minimum) / span for value in numeric_values]


def categorize_risk(score):
    if score < LOW_RISK_THRESHOLD:
        return "Low Risk"
    if score < MEDIUM_RISK_THRESHOLD:
        return "Medium Risk"
    return "High Risk"


def score_metrics(metrics):
    """Score a complete repository-wide list of unified metric rows."""
    rows = list(metrics)
    normalized_by_metric = {
        metric_name: normalize_values(
            [metric_value(row, metric_name) for row in rows]
        )
        for metric_name, _ in WEIGHTED_METRICS
    }
    scored = []
    for index, row in enumerate(rows):
        contributions = {}
        for metric_name, weight in WEIGHTED_METRICS:
            contribution = normalized_by_metric[metric_name][index] * weight * 100
            contributions[f"{metric_name}_contribution"] = round(contribution, 4)
        risk_score = round(sum(contributions.values()), 2)
        scored.append(
            {
                **row,
                "risk_score": risk_score,
                "risk_category": categorize_risk(risk_score),
                **contributions,
            }
        )
    return scored


def aggregate_risk(scored_metrics):
    """Return category counts, top ten files, and average repository risk."""
    rows = list(scored_metrics)
    category_counts = {"Low Risk": 0, "Medium Risk": 0, "High Risk": 0}
    for row in rows:
        category = row["risk_category"]
        category_counts[category] = category_counts.get(category, 0) + 1

    top_ten = sorted(rows, key=lambda row: row["risk_score"], reverse=True)[:10]
    return {
        "category_counts": category_counts,
        "top_10_by_risk_score": [
            {"filename": row["filename"], "risk_score": row["risk_score"]}
            for row in top_ten
        ],
        "average_risk_score": (
            sum(row["risk_score"] for row in rows) / len(rows) if rows else 0
        ),
    }