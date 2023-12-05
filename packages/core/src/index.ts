import type { QueryAndStore } from './QueryAndStore'

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

type AddResources = { type: 'add resources'; variable: `?${string}` }
export type RdfQuery = (TransformStore | Match | AddResources)[]