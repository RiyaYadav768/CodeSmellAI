import networkx as nx

def calculate_metrics(G):

    pagerank_scores = nx.pagerank(G)

    results = []

    for node in G.nodes():

        results.append({
            "filename": node,
            "degree": G.degree(node),
            "in_degree": G.in_degree(node),
            "pagerank": round(pagerank_scores[node], 4)
        })

    return results