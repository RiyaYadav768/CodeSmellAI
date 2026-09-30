import pandas as pd


CSV_COLUMNS = [
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
    "bug_fix_commit_count_contribution",
    "commit_count_contribution",
    "distinct_author_count_contribution",
    "ai_explanation",
]


def export_metrics(metrics):

    df = pd.DataFrame(metrics)
    ordered_columns = [column for column in CSV_COLUMNS if column in df.columns]
    remaining_columns = [column for column in df.columns if column not in ordered_columns]
    df = df[ordered_columns + remaining_columns]

    df.to_csv("metrics.csv", index=False)

    print("CSV exported successfully!")