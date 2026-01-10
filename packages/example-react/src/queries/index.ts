/* eslint-disable import/no-unused-modules */
import { ldhop } from '@ldhop/core'
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

export const friendOfAFriendQuery = ldhop('?person')
  .match('?person', foaf.knows)
  .o('?person')

export const friendOfAFriendQuerySolidCommunityFix = ldhop('?person')
  .match('?person', foaf.knows)
  .o('?personNext')
  .transform('?personNext', '?person', term =>
    term.termType === 'NamedNode'
      ? new NamedNode(
          term.value.replace('solid.community', 'solidcommunity.net'),
        )
      : undefined,
  )
