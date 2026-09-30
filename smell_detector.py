import ast
import logging
import os
import tokenize


logger = logging.getLogger(__name__)

# Tune all smell thresholds here; rule implementations below do not contain
# threshold literals.
LONG_FUNCTION_LINE_THRESHOLD = 50
MAX_PARAMETER_COUNT = 5
MAX_NESTING_DEPTH = 4
LARGE_FILE_LOC_THRESHOLD = 500
GOD_CLASS_METHOD_THRESHOLD = 10


def _read_source(file_path):
    with tokenize.open(file_path) as source_file:
        return source_file.read()


def _loc(source):
    return sum(
        bool(line.strip()) and not line.lstrip().startswith("#")
        for line in source.splitlines()
    )


def _function_parameter_count(node):
    arguments = node.args
    return (
        len(arguments.posonlyargs)
        + len(arguments.args)
        + len(arguments.kwonlyargs)
        + bool(arguments.vararg)
        + bool(arguments.kwarg)
    )


def _function_line_count(node):
    return (node.end_lineno or node.lineno) - node.lineno + 1


def _is_block(node):
    return isinstance(
        node,
        (
            ast.If,
            ast.For,
            ast.AsyncFor,
            ast.While,
            ast.Try,
            ast.With,
            ast.AsyncWith,
            ast.FunctionDef,
            ast.AsyncFunctionDef,
            ast.ClassDef,
        ),
    )


class _NestingVisitor(ast.NodeVisitor):
    def __init__(self):
        self.depth = 0
        self.max_depth = 0
        self.excessive_blocks = 0

    def generic_visit(self, node):
        is_block = _is_block(node)
        if is_block:
            self.depth += 1
            self.max_depth = max(self.max_depth, self.depth)
            if self.depth > MAX_NESTING_DEPTH:
                self.excessive_blocks += 1
        super().generic_visit(node)
        if is_block:
            self.depth -= 1


def _cyclomatic_complexity(tree):
    complexity = 1
    for node in ast.walk(tree):
        if isinstance(
            node,
            (
                ast.If,
                ast.For,
                ast.AsyncFor,
                ast.While,
                ast.ExceptHandler,
                ast.IfExp,
            ),
        ):
            complexity += 1
        elif isinstance(node, ast.BoolOp):
            complexity += len(node.values) - 1
        elif isinstance(node, ast.comprehension):
            complexity += 1 + len(node.ifs)
        elif isinstance(node, ast.match_case):
            complexity += 1
    return complexity


def rule_long_function(tree, metrics):
    return sum(
        _function_line_count(node) > LONG_FUNCTION_LINE_THRESHOLD
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    )


def rule_too_many_parameters(tree, metrics):
    return sum(
        _function_parameter_count(node) > MAX_PARAMETER_COUNT
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    )


def rule_deep_nesting(tree, metrics):
    visitor = _NestingVisitor()
    visitor.visit(tree)
    return visitor.excessive_blocks


def rule_large_file(tree, metrics):
    return int(metrics["loc"] > LARGE_FILE_LOC_THRESHOLD)


def rule_god_class(tree, metrics):
    return sum(
        sum(
            isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef))
            for item in node.body
        )
        > GOD_CLASS_METHOD_THRESHOLD
        for node in ast.walk(tree)
        if isinstance(node, ast.ClassDef)
    )


SMELL_RULES = (
    ("long_function", rule_long_function),
    ("too_many_parameters", rule_too_many_parameters),
    ("deep_nesting", rule_deep_nesting),
    ("large_file", rule_large_file),
    ("god_class", rule_god_class),
)


def detect_smells(tree, metrics, enabled_rules=None):
    """Run enabled independent rules and return category counts."""
    enabled_rules = set(enabled_rules) if enabled_rules is not None else None
    breakdown = {}
    for name, rule in SMELL_RULES:
        if enabled_rules is None or name in enabled_rules:
            breakdown[name] = rule(tree, metrics)
    return breakdown


def analyze_source(source, filename="<string>", enabled_rules=None):
    """Analyze already-loaded Python source and return one file's metrics."""
    tree = ast.parse(source, filename=filename)
    nesting = _NestingVisitor()
    nesting.visit(tree)
    metrics = {
        "filename": filename,
        "cyclomatic_complexity": _cyclomatic_complexity(tree),
        "loc": _loc(source),
        "function_count": sum(
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            for node in ast.walk(tree)
        ),
        "class_count": sum(
            isinstance(node, ast.ClassDef) for node in ast.walk(tree)
        ),
        "max_nesting_depth": nesting.max_depth,
    }
    metrics["smell_breakdown"] = detect_smells(tree, metrics, enabled_rules)
    metrics["smell_count_total"] = sum(metrics["smell_breakdown"].values())
    # Maintainability Index = clamp(100 - 2*complexity - 0.05*LOC - 5*smell_count, 0, 100).
    metrics["maintainability_index"] = round(
        max(
            0,
            min(
                100,
                100
                - 2 * metrics["cyclomatic_complexity"]
                - 0.05 * metrics["loc"]
                - 5 * metrics["smell_count_total"],
            ),
        ),
        2,
    )
    return metrics


def analyze_file(file_path, repo_root, enabled_rules=None):
    """Analyze one file, logging and skipping unreadable or invalid files."""
    filename = os.path.relpath(
        os.path.abspath(file_path), os.path.abspath(repo_root)
    ).replace(os.sep, "/")
    try:
        return analyze_source(_read_source(file_path), filename, enabled_rules)
    except (OSError, UnicodeError, SyntaxError) as error:
        logger.warning("Skipping %s: %s", file_path, error)
        return None


def analyze_files(file_paths, repo_root, enabled_rules=None):
    """Analyze scanner output without rescanning and return path-keyed metrics."""
    results = {}
    for file_path in file_paths:
        result = analyze_file(file_path, repo_root, enabled_rules)
        if result is not None:
            results[result["filename"]] = result
    return results


def merge_metrics(structural_metrics, smell_metrics):
    """Merge path-keyed smell rows into structural rows with zero-safe defaults."""
    merged = []
    structural_by_path = {row["filename"]: row for row in structural_metrics}
    all_paths = list(dict.fromkeys((*structural_by_path, *smell_metrics)))
    for path in all_paths:
        row = {
            "filename": path,
            "degree": 0,
            "in_degree": 0,
            "pagerank": 0,
            **structural_by_path.get(path, {}),
        }
        row.update(smell_metrics.get(path, {}))
        merged.append(row)
    return merged


def aggregate_repository(smell_metrics):
    """Return repository-level complexity, LOC, ranking, and smell totals."""
    rows = list(smell_metrics.values())
    complexities = [row["cyclomatic_complexity"] for row in rows]
    loc_values = [row["loc"] for row in rows]
    category_totals = {}
    for row in rows:
        for category, count in row["smell_breakdown"].items():
            category_totals[category] = category_totals.get(category, 0) + count

    def top_by(field):
        return [
            {"filename": row["filename"], field: row[field]}
            for row in sorted(rows, key=lambda item: item[field], reverse=True)[:5]
        ]

    return {
        "complexity": {
            "min": min(complexities, default=0),
            "max": max(complexities, default=0),
            "average": sum(complexities) / len(complexities) if rows else 0,
        },
        "loc": {
            "min": min(loc_values, default=0),
            "max": max(loc_values, default=0),
            "average": sum(loc_values) / len(loc_values) if rows else 0,
        },
        "top_5_by_complexity": top_by("cyclomatic_complexity"),
        "top_5_by_smell_count": top_by("smell_count_total"),
        "smell_count_by_category": category_totals,
    }