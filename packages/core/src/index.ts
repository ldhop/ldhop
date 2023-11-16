import { BlankNode, Literal, NamedNode, Quad, Store, Variable } from 'n3'

// as input, we expect array of RDF quads where "graph" part is the filename. This must be prepared beforehand.
type VariableDict = {
  [key: string]: (Quad | NamedNode | Literal | BlankNode | Variable)[]
}

type TransformStore = (
  store: Store,
  variables: VariableDict,
  addResource: (resource: string) => void,
) => void

type Match = {
  type: 'match'
  subject?: string
  predicate?: string
  object?: string
  graph?: string
  pick: 'subject' | 'predicate' | 'object' | 'graph'
  target: `?${string}`
}

type AddResources = { type: 'add resources'; variable: `?${string}` }
export type RdfQuery = (TransformStore | Match | AddResources)[]

/**
 * ??
 */
export const followNose = (query: RdfQuery) => {
  const store = new Store()

  query

  store.addQuads([])
}
