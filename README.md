# ldhop - Follow your nose through Linked Data resources

Start with a resource, and then follow your nose through the Knowledge graph, discover and fetch new resources, and keep following your nose

Also, it should be possible to update and re-fetch one of the resources, and everything else should get adjusted accordingly.

## Concept:

We'll have a RDF store at the center. We specify how we want to walk through the knowledge graph.

When resource is added or changed, we check whether there was anything new in that resource. If yes, we replace the old resource with the new one; and trickle the dependencies further.
