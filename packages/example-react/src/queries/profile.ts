import type { LdhopQuery, Match, QueryVariables } from '@ldhop/core'
import { ldp, rdfs, solid, space } from 'rdf-namespaces'

export const personInbox: Match<'?person' | '?inbox'> = {
  type: 'match',
  subject: '?person',
  predicate: ldp.inbox,
  pick: 'object',
  target: '?inbox',
}

export const profileDocuments: LdhopQuery<'?person' | '?profileDocument'> = [
  {
    type: 'match',
    subject: '?person',
    predicate: rdfs.seeAlso, // TODO also include foaf.isPrimaryTopicOf
    pick: 'object',
    target: '?profileDocument',
  },
  // fetch the profile documents
  { type: 'add resources', variable: '?profileDocument' },
]

export const publicWebIdProfileQuery: LdhopQuery<
  QueryVariables<typeof profileDocuments> | '?publicTypeIndex'
> = [
  ...profileDocuments,
  // find public type index
  {
    type: 'match',
    subject: '?person',
    predicate: solid.publicTypeIndex,
    pick: 'object',
    target: '?publicTypeIndex',
  },
]

// find person and their profile documents
// https://solid.github.io/webid-profile/#discovery
export const webIdProfileQuery: LdhopQuery<
  | QueryVariables<typeof publicWebIdProfileQuery>
  | '?preferencesFile'
  | '?inbox'
  | '?privateTypeIndex'
> = [
  ...publicWebIdProfileQuery,
  // find and fetch preferences file
  // https://solid.github.io/webid-profile/#discovery
  {
    type: 'match',
    subject: '?person',
    predicate: space.preferencesFile,
    pick: 'object',
    target: '?preferencesFile',
  },
  { type: 'add resources', variable: '?preferencesFile' },
  // find and fetch private type index
  {
    type: 'match',
    subject: '?person',
    predicate: solid.privateTypeIndex,
    pick: 'object',
    target: '?privateTypeIndex',
  },
  personInbox,
]
