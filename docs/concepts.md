# Concepts and Thoughts to Process

Generalize sufficiently, to be independent of any particular storage mechanism. Ultimately, it would be usable with LDO via @ldo/connected dataset, or NextGraph.

Operate on any dataset, even if it's large. It shouldn't matter and influence the outcome if there are other additional resources. We don't need to delete resource if it's no longer needed.

Maybe we build the path along the steps separately?

There is a mapping from resources to graphs. Normally a resource is the graph, but sometimes graph may be more specific. We want to know which resources the graph is in though. Can there be a graph spanning multiple resources? No, I think I only want graphs within a resource that they're identified by. Like... if I put graph into the URL, I will get it.

I suppose I'll require that they're separate.

There is a mapping from redirects to final resources. Typically we want the final resource to be the graph, but we want to keep track of the redirects...

We want to keep track of the load status of the resources, and which resources we need.

There is this large dataset, but we only want to operate on the resources we need. We don't want triples from random datasets. Maybe we want only a dataset made of the resources we need, then. We can cache resources on individual level. It's nice to have a global dataset for the app though.

Shape has links. => Supershape. You can often replace IRI with another shape.

LDO + LDhop? The simplest is get the dataset, feed it into ldhop, and update it via ldhop. Or some caching structure?

Hop through a shape, then through a next shape, ...

```
[
  {
    shape: LDO shape
    match: match subject, predicate, or object
    jumps: {
      predicate: { predicate: new variable }
      predicate: new variable
    }
  }
]
```

## Layers:

### Resource

Single resources, RDF or not. We care about RDF. This is a sensible layer to chache.

How expensive is it to re-run the whole query every time, on top of the current dataset?

Resource & updating

- last fetched (keep timestamp)
- force refetch
- refetch regularly
- refetch if requested & stale
- subscribe to change notifications and refetch when notified
- keep when offline

URLs may have redirects. In case of redirect, the resource URL is the final url. We may want to track the redirects for e.g. caching purposes.

Always without `#hash` part. `?searchQuery` part may matter though.

many-to-one

```
{
  url => resource
  url => resource
  url => resource
}
```

one-to-many

```
{
  resource => Set(starting uris)
}
```

### Permissions

Each resource may have associated permissions. WAC, ACP. The person making the request may or may not have access to thesse permissions, or some lesser information about these.

### Dataset

A combination of resources, a set of Quads and operations. It is a graph. Dataset is split into disjoint subgraphs. Each Quad belongs to exactly one graph. These are identical to the final resource uri of the request.

### Query

Query is a set of instructions to follow, to start from a certain point, and make hops through the Dataset until the desired depth is reached.

### Dataset associated with Query (Query Dataset)

This is a dataset consisting of resources that were reached and requested by the query. It grows as the query is executed. It's a subset of the total application Dataset.
Query has a starting point.

### Hops/Moves/Abstract Path through the Dataset

Moves connected by target -> source variables.

These are the actual steps that were done by the query engine through the Query Dataset. It has starting variables, final variable, step, and maybe the quads involved.

In a sense previous steps hold the next steps. If a quad is deleted, then the path and associated datased no longer held collapses - and gets removed.

The whole construct is held by one or multiple starting points - uris associated with a variable.

We also need to keep cycles in consideration. With naïve approach, they will self-hold. However, in a deeper analysis, they are not.

See [Orphaned Cycles](orphaned-cycles.md) for details.

### Note on matching

When matching a pattern without any input variable, it implicitly operates on all graphs/resources. But maybe we want to prevent that? How do we deal with this situation during removal? Always reevaluate? Ok, reevaluating after every deletion is probably the safest approach. Other option would be to keep the graph as a variable, always. This way connect steps that require a resource to steps that use it. But maybe we just keep requiring a connection between steps, like always a variable involved in sources.

###

So, we have Resource, Dataset, Query, Query Dataset, Hops/Moves.

The Datasets can be in any format supporting RDF Quads and necessary operations. Hops/Moves are internal. Resources are a layer external to the QaS. Keeping track of resources is internal, in current implementation it's done with meta quads.

necessary operations:

removeQuads
removeQuad
addQuad
getQuads
getObjects
getSubjects
has(Quad): boolean
match(subject?: Term|null, predicate?: Term|null, object?: Term|null, graph?: Term|null):
