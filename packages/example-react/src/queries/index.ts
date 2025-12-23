/* eslint-disable import/no-unused-modules */
import { LdhopQuery } from '@ldhop/core'
import { NamedNode } from 'n3'
import { foaf } from 'rdf-namespaces'

export {
  accommodationQuery,
  readPersonAccommodationsQuery,
  searchAccommodationsQuery,
} from './accommodations'
export { readCommunityMembersQuery, readCommunityQuery } from './community'
export { contactRequestsQuery, contactsQuery } from './contacts'
export {
  hospexDocumentQuery,
  privateProfileAndHospexDocumentQuery,
} from './hospex'
export { inboxMessagesQuery, messages, threads } from './messages'
export { profileDocuments, webIdProfileQuery } from './profile'

export const friendOfAFriendQuery: LdhopQuery<'?person'> = [
  {
    type: 'match',
    subject: '?person',
    predicate: foaf.knows,
    pick: 'object',
    target: '?person',
  },
]

export const friendOfAFriendQuerySolidCommunityFix: LdhopQuery<
  '?person' | '?personNext'
> = [
  {
    type: 'match',
    subject: '?person',
    predicate: foaf.knows,
    pick: 'object',
    target: '?personNext',
  },
  {
    type: 'transform variable',
    source: '?personNext',
    target: '?person',
    transform: term =>
      term.termType === 'NamedNode'
        ? new NamedNode(
            term.value.replace('solid.community', 'solidcommunity.net'),
          )
        : undefined,
  },
]
