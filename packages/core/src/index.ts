import type { QueryAndStore } from './QueryAndStore'
export { QueryAndStore } from './QueryAndStore'
export { fetchRdfDocument } from './utils/helpers'

export type TransformStore = (qas: QueryAndStore) => void

export type Match = {
  type: 'match'
  subject?: string
  predicate?: string
  object?: string
  graph?: string
  pick: 'subject' | 'predicate' | 'object' | 'graph'
  target: `?${string}`
}

export type TransformVariable = {
  type: 'transform variable'
  source: `?${string}`
  target: `?${string}`
  transform: (uri: string) => string
}

type AddResources = { type: 'add resources'; variable: `?${string}` }
export type RdfQuery = (
  | TransformStore
  | Match
  | AddResources
  | TransformVariable
)[]
