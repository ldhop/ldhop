# `@ldhop/core`

LDhop - Follow your nose through Linked Data graph. This is the core engine package.

> **📢 Deprecated API Notice**: Looking for the old `QueryAndStore` interface? See the [previous version documentation](https://www.npmjs.com/package/@ldhop/core/v/0.1.1) (will be removed in version 1.0).

## Usage

```sh
npm install @ldhop/core --save
yarn add @ldhop/core
```

```ts
import {
  LdhopEngine,
  type LdhopQuery,
  type Variable,
  fetchRdfDocument,
  run,
} from '@ldhop/core'
import { foaf, rdfs } from 'rdf-namespaces'

// to prevent typos and keep the query clean, it's recommended to specify the variables explicitly.
enum Var {
  person = '?person',
  extendedProfile = '?extendedProfile',
}

Object.values(Var) satisfies Variable[]

// specify the steps of the query
// in this case fetch the whole foaf social network
// and also look in extended profile documents
const friendOfAFriendQuery: LdhopQuery<Var> = [
  {
    type: 'match',
    subject: Var.person,
    predicate: foaf.knows,
    pick: 'object',
    target: Var.person,
  },
  {
    type: 'match',
    subject: Var.person,
    predicate: rdfs.seeAlso,
    pick: 'object',
    target: Var.extendedProfile,
  },
  {
    type: 'add resources',
    variable: Var.extendedProfile,
  },
]

// specify starting points
const initialVariables = { [Var.person]: new Set([webId]) }

// initialize the engine
const engine = new LdhopEngine(friendOfAFriendQuery, initialVariables)

// now, you need to ask for missing resources, fetch them, add them to LdhopEngine
// and keep doing that until there are no missing resources left
// you can use a simple helper provided by this library
await run(engine, fetch)

// or implement your own walk, using the following methods repeatedly:
const missingResources = engine.getMissingResources()
if (missingResources.size > 0) {
  const [missingResource] = Array.from(missingResources)
  // TODO show how to include redirects
  const { data } = await fetchRdfDocument(missingResource, fetch)
  engine.addGraph(missingResource, data)
}

// now, you have the whole RDF graph collected in engine.store, which is n3.Store
// each triple has a graph element that corresponds to the url of the document of that triple
const store = engine.store

// you can access specific variables
engine.getVariable(Var.person)
// or all variables
engine.getAllVariables()
```

### Callbacks

You can also pass callbacks to `LdhopEngine` as 4th argument. This can be an alternative approach to query execution (even a preferable one).

```ts
const engine = new LdhopEngine(
  friendOfAFriendQuery,
  initialVariables,
  undefined,
  {
    onNeedResource: (uri: string) => {},
    onDropResource: (uri: string) => {},
    onQueryComplete: () => {},
    onVariableAdded: (
      variable: Variable,
      term: n3.Term,
      variables: Set<n3.Term>,
    ) => {},
    onVariableRemoved: (
      variable: Variable,
      term: n3.Term,
      variables: Set<n3.Term>,
    ) => {},
  },
)
```

## Query

Query is an array of instructions to follow in order to discover and fetch desired Linked data.

It proceeds lazily - only requests next documents when they're needed for next steps, or if explicitly instructed.

The following steps are supported:

```ts
// step through the graph
// type Variable extends `?${string}`
// type Constant is usually an URI, a string starting with some sensible characters (not '?')

type Match<Variable> = {
  type: 'match'
  // optional constraints, either URI, or variable starting with ?
  subject?: Variable | Constant
  predicate?: Variable | Constant
  object?: Variable | Constant
  graph?: Variable | Constant
  // which of the quad components to assign to the target variable?
  pick: 'subject' | 'predicate' | 'object' | 'graph'
  // variable that results will be assigned to, starting with ?
  target: Variable
}
```

```ts
// fetch documents behind variable, even if it isn't needed for next steps
type AddResources<Variable> = {
  type: 'add resources'
  variable: Variable // variable to fetch
}
```

```ts
// change variable, for example get container of a resource
type TransformVariable<Variable> = {
  type: 'transform variable'
  source: Variable
  target: Variable
  // function to transform source to target
  transform: (uri: Term) => Term | undefined
}
```

#### Filtering

Filtering can be achieved using `match` step, and assigning the result to a new variable.

### Example query: Fetch Solid WebId Profile

See [Solid WebID Profile specification](https://solid.github.io/webid-profile/#discovery) for context.

```ts
import type { LdhopQuery, Variable } from '@ldhop/core'
import { pim, rdfs, solid, ldp } from 'rdf-namespaces'

// TODO change examples to variables without enum
enum Var {
  person = '?person',
  preferencesFile = '?preferencesFile',
  profileDocument = '?profileDocument',
  publicTypeIndex = '?publicTypeIndex',
  privateTypeIndex = '?privateTypeIndex',
  inbox = '?inbox',
}

Object.values(Var) satisfies Variable[]

// find person and their profile documents
const webIdProfileQuery: LdhopQuery<Var> = [
  // find and fetch preferences file
  {
    type: 'match',
    subject: Var.person,
    predicate: pim.preferencesFile,
    pick: 'object',
    target: Var.preferencesFile,
  },
  { type: 'add resources', variable: Var.preferencesFile },
  // find extended profile documents
  {
    type: 'match',
    subject: Var.person,
    predicate: rdfs.seeAlso,
    pick: 'object',
    target: Var.profileDocument,
  },
  // fetch the extended profile documents
  { type: 'add resources', variable: Var.profileDocument },
  // find public type index
  {
    type: 'match',
    subject: Var.person,
    predicate: solid.publicTypeIndex,
    pick: 'object',
    target: Var.publicTypeIndex,
  },
  // find private type index
  {
    type: 'match',
    subject: Var.person,
    predicate: solid.privateTypeIndex,
    pick: 'object',
    target: Var.privateTypeIndex,
  },
  // find inbox
  {
    type: 'match',
    subject: Var.person,
    predicate: ldp.inbox,
    pick: 'object',
    target: Var.inbox,
  },
]
```

The query corresponds to the following picture. The resources identified by the URIs within the variables in **bold circles** are fetched while it is executed.

![webId profile query visualized](https://raw.githubusercontent.com/ldhop/ldhop/main/docs/webid_profile_query_visual.png)

## API

### LdhopEngine

#### Creating an instance

```ts
const engine = new LdhopEngine(query, startingPoints, store?)
```

**Parameters:**

- `query: LdhopQuery<Variable>` - the query to execute
- `startingPoints: MixedVariableSets<Variable>` - initial variable bindings
- `store?: n3.Store` - optional RDF store (defaults to new Store)

#### Properties

- `store: n3.Store` - store containing RDF graph
- `query: LdhopQuery<Variable>` - ldhop [query](#query)

#### Methods

- `getMissingResources(): Set<string>` - returns set of resources that still need to be fetched and added
- `addGraph(actualUri: string, quads: n3.Quad[], requestedUri?: string)` - add resource after it has been fetched. Use `requestedUri` parameter if the resource was redirected from a different URI
- `removeGraph(uri: string)` - delete resource from store and clean up related variables
- `getVariable(variableName: Variable): Set<Term> | undefined` - get set of RDF terms belonging to this variable
- `getVariableAsStringSet(variableName: Variable): Set<string>` - get variable values as string URIs
- `getAllVariables()` - get map of all discovered variables
- `getAllPlainVariables()` - get all variables' values in the form without question mark
- `getAllVariablesAsStringSets()` - get all variables with values as string sets
- `getGraphs(added?: boolean): Set<string>` - get resource URIs by status (added/missing/all)

### fetchRdfDocument

Fetch turtle document and parse it to ldhop-compatible quads

```ts
const { data } = await fetchRdfDocument(uri, fetch)
// If there was a redirect, pass both URIs
engine.addGraph(response.url, data, uri) // response.url is actual, uri is requested
// For no redirect, just pass the actual URI
engine.addGraph(uri, data)
```

### run

Execute the ldhop query until the walk through the graph is finished.

It runs simple loop that continues as long as `engine.getMissingResources()` returns something: It fetches one missing resource, adds it with `engine.addGraph()` and repeats. You can implement something more efficient yourself, e.g. fetch missing resources in parallel.

You can provide custom (e.g. authenticated) fetch.

```ts
const engine = new LdhopEngine(query, initialVariables)
await run(engine, fetch)
```
