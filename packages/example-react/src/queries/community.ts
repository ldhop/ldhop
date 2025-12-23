import type { LdhopQuery, QueryVariables } from '@ldhop/core'
import { sioc, vcard } from 'rdf-namespaces'

export const readCommunityQuery: LdhopQuery<'?community' | '?group'> = [
  {
    type: 'match',
    subject: '?community',
    predicate: sioc.has_usergroup,
    pick: 'object',
    target: '?group',
  },
]

export const readCommunityMembersQuery: LdhopQuery<
  QueryVariables<typeof readCommunityQuery> | '?person'
> = [
  ...readCommunityQuery,
  {
    type: 'match',
    subject: '?group',
    predicate: vcard.hasMember,
    pick: 'object',
    target: '?person',
  },
]
