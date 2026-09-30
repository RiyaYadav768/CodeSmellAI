import networkx as nx

def build_graph(dependency_map):

    G = nx.DiGraph()

    # Add nodes
    for file_name in dependency_map:

        node_name = file_name.replace(".py", "")

        G.add_node(node_name)

    # Internal modules only
    internal_modules = {
        file_name.replace(".py", "")
        for file_name in dependency_map
    }

    # Add edges
    for file_name, imports in dependency_map.items():

        source = file_name.replace(".py", "")

        for imported_module in imports:

            if imported_module in internal_modules:

                G.add_edge(source, imported_module)

    return G