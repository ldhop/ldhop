import type { LdhopQuery, QueryVariables } from '@ldhop/core'
import { hospex } from '../utils/rdf-namespaces'
import { readCommunityMembersQuery } from './community'
import { hospexDocumentQuery } from './hospex'

const qa = hospexDocumentQuery.toArray()

export const readPersonAccommodationsQuery: LdhopQuery<
  QueryVariables<typeof qa> | '?offer'
> = [
  ...hospexDocumentQuery,
  {
    type: 'match',
    subject: '?person',
    predicate: hospex.offers,
    graph: '?hospexDocumentForCommunity',
    pick: 'object',
    target: '?offer',
  },
  { type: 'add resources', variable: '?offer' },
]

/**
 * Fetch hosting offers from all community members
 * TODO there are security checks missing
 * we should make sure that accommodation is offered by the user who offers it (check both directions of the relationship)
 */
export const searchAccommodationsQuery: LdhopQuery<
  | QueryVariables<typeof readCommunityMembersQuery>
  | QueryVariables<typeof readPersonAccommodationsQuery>
> = [...readCommunityMembersQuery, ...readPersonAccommodationsQuery]

export const accommodationQuery: LdhopQuery<'?offer' | '?person'> = [
  {
    type: 'match',
    subject: '?offer',
    predicate: hospex.offeredBy,
    pick: 'object',
    target: '?person',
  },
]
