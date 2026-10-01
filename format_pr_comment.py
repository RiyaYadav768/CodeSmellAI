import argparse
import csv
import os
from pathlib import Path


COMMENT_MARKER = "<!-- codesmell-ai-report -->"


def _normalize_path(path):
    return os.path.normpath(path.strip().replace("\\", "/")).replace(os.sep, "/").removeprefix("./")


def _markdown_cell(value):
    return " ".join(str(value or "").replace("|", "\\|").split())


def format_comment(metrics_path, changed_files_path, top_n=15, warning_threshold=40):
    if top_n < 0:
        raise ValueError("top_n must be zero or greater")

    with Path(metrics_path).open(newline="", encoding="utf-8") as metrics_file:
        metrics = {
            _normalize_path(row.get("filename", "")): row
            for row in csv.DictReader(metrics_file)
            if row.get("filename")
        }

    with Path(changed_files_path).open(encoding="utf-8") as changed_file:
        changed_files = list(dict.fromkeys(
            _normalize_path(line) for line in changed_file if line.strip()
        ))

    python_files = [path for path in changed_files if Path(path).suffix.lower() == ".py"]
    scored_details = []
    missing_details = []
    matched_rows = []
    for path in python_files:
        row = metrics.get(path)
        if row is None:
            missing_details.append((path, None))
            continue
        matched_rows.append(row)
        try:
            score = float(row.get("risk_score", 0) or 0)
        except (TypeError, ValueError):
            score = 0.0
        scored_details.append((path, (row, score)))

    scored_details.sort(
        key=lambda detail: (-detail[1][1], detail[0]),
    )
    details = scored_details + missing_details
    flagged_count = sum(
        row.get("risk_category") in {"Medium Risk", "High Risk"}
        for row in matched_rows
    )
    has_high_risk = any(row.get("risk_category") == "High Risk" for row in matched_rows)

    lines = [
        COMMENT_MARKER,
        f"**{len(changed_files)} files changed, {flagged_count} flagged Medium/High risk.**",
    ]
    if not matched_rows:
        lines.append("No analyzable Python files changed.")
        missing_files = [path for path, detail in details if detail is None]
        if missing_files:
            lines.append(
                "Changed Python files absent from the analysis (likely deleted): "
                + ", ".join(f"`{_markdown_cell(path)}`" for path in missing_files)
                + "."
            )

    if details:
        lines.extend([
            "",
            "| File | Risk score | Risk category | Explanation |",
            "| --- | ---: | --- | --- |",
        ])
        shown_details = details[:top_n]
        for path, detail in shown_details:
            if detail is None:
                cells = (path, "N/A", "Deleted / unavailable", "No metrics row found.")
            else:
                row, score = detail
                category = row.get("risk_category", "Unknown")
                if score >= warning_threshold:
                    category = f"**WARNING: {category}**"
                cells = (path, f"{score:g}", category, row.get("ai_explanation", ""))
            lines.append("| " + " | ".join(_markdown_cell(cell) for cell in cells) + " |")
        omitted_count = len(details) - len(shown_details)
        if omitted_count:
            lines.extend(["", f"...and {omitted_count} more files not shown."])

    return "\n".join(lines), has_high_risk


def main():
    parser = argparse.ArgumentParser(description="Format CodeSmellAI metrics for a PR comment")
    parser.add_argument("--metrics", default="metrics.csv", help="Pipeline metrics CSV")
    parser.add_argument(
        "--changed-files",
        required=True,
        help="Text file containing one repository-relative changed path per line",
    )
    parser.add_argument("--top-n-files", type=int, default=15)
    parser.add_argument("--risk-threshold-warning", type=float, default=40)
    parser.add_argument("--output", default="pr-comment.md")
    parser.add_argument("--github-output", help="Optional GitHub Actions output file")
    args = parser.parse_args()

    body, has_high_risk = format_comment(
        args.metrics,
        args.changed_files,
        top_n=args.top_n_files,
        warning_threshold=args.risk_threshold_warning,
    )
    Path(args.output).write_text(body, encoding="utf-8")
    if args.github_output:
        with Path(args.github_output).open("a", encoding="utf-8") as output_file:
            output_file.write(f"has-high-risk={str(has_high_risk).lower()}\n")


if __name__ == "__main__":
    main()