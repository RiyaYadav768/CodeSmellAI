import os
import logging

from scanner import get_python_files
from parser import extract_imports
from graph_builder import build_graph
from metrics import calculate_metrics
from export_csv import export_metrics
from graph_visualizer import save_graph_image
from ai_insights import add_explanations
from git_miner import merge_git_metrics, mine_git_metrics
from risk_scorer import aggregate_risk, score_metrics
from smell_detector import analyze_files, merge_metrics

logger = logging.getLogger(__name__)

repo_files = get_python_files("test_repo")

dependency_map = {}

for file_path in repo_files:

    try:
        imports = extract_imports(file_path)
    except (OSError, UnicodeError, SyntaxError) as error:
        logger.warning("Skipping %s during import parsing: %s", file_path, error)
        continue

    file_name = os.path.basename(file_path)

    dependency_map[file_name] = imports

print("Dependency Map:")
print(dependency_map)

G = build_graph(dependency_map)

print("\nNodes:")
print(list(G.nodes()))

print("\nEdges:")
print(list(G.edges()))

metrics = calculate_metrics(G)

smell_metrics = analyze_files(repo_files, "test_repo")
structural_metrics = []

for row in metrics:
    matching_file = next(
        (
            file_path
            for file_path in repo_files
            if os.path.splitext(os.path.basename(file_path))[0] == row["filename"]
        ),
        None,
    )
    if matching_file is not None:
        relative_path = os.path.relpath(matching_file, "test_repo").replace(os.sep, "/")
        structural_metrics.append({**row, "filename": relative_path})

metrics = merge_metrics(structural_metrics, smell_metrics)
git_metrics = mine_git_metrics("test_repo", repo_files)
metrics = merge_git_metrics(metrics, git_metrics)
metrics = score_metrics(metrics)
metrics = add_explanations(metrics)

risk_summary = aggregate_risk(metrics)

print("\nMetrics:")

for row in metrics:
    print(row)

print("\nRisk Summary:")
print(risk_summary)

export_metrics(metrics)

save_graph_image(G)