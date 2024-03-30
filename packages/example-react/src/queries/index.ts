/* eslint-disable import/no-unused-modules */
import { RdfQuery } from '@ldhop/core'
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

export const friendOfAFriendQuery: RdfQuery = [
  {
    type: 'match',
    subject: '?person',
    predicate: foaf.knows,
    pick: 'object',
    target: '?person',
  },
]
