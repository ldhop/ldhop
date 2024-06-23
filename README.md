# LDhop - Follow Your Nose Through Linked Data Resources

Start with a resource, and then follow your nose through the Knowledge graph, discover and fetch new resources, and keep following your nose

Also, it's possible to update and re-fetch one of the resources, and everything else will get adjusted accordingly.

## Concept

We have a RDF store at the center. We specify how we want to walk through the knowledge graph. When we arrive at a new resource, we fetch it, and continue the walk through it.

When resource is added or changed, we check whether there was anything new in that resource. If yes, we replace the old resource with the new one; and trickle the dependencies further.

## Query

[Read here](https://npmjs.com/package/@ldhop/core#query)
