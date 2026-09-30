import ast

def extract_imports(file_path):

    with open(file_path, "r") as f:
        code = f.read()

    tree = ast.parse(code)

    imports = []

    for node in ast.walk(tree):

        if isinstance(node, ast.Import):

            for alias in node.names:
                imports.append(alias.name)

        elif isinstance(node, ast.ImportFrom):

            if node.module:
                imports.append(node.module)

    return imports