import matplotlib.pyplot as plt
import networkx as nx

def save_graph_image(G):

    plt.figure(figsize=(8,6))

    pos = nx.spring_layout(G)

    nx.draw(
        G,
        pos,
        with_labels=True
    )

    plt.savefig("dependency_graph.png")

    plt.close()

    print("Graph image saved!")