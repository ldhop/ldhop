import { difference } from 'lodash'
import * as n3 from 'n3'
import { RdfQuery } from '../src'
import { dct, foaf, hospex, sioc, solid, vcard } from './rdf-namespaces'

export const personAccommodationsQuery: RdfQuery = [
  {
    type: 'match',
    subject: '?person',
    predicate: solid.publicTypeIndex,
    pick: 'object',
    target: '?publicTypeIndex',
  },
  {
    type: 'match',
    subject: '?publicTypeIndex',
    predicate: dct.references,
    pick: 'object',
    target: '?typeRegistration',
  },
  {
    type: 'match',
    subject: '?typeRegistration',
    predicate: solid.forClass,
    object: hospex.PersonalHospexDocument,
    pick: 'subject',
    target: '?typeRegistrationForHospex',
  },
  {
    type: 'match',
    subject: '?typeRegistrationForHospex',
    predicate: solid.instance,
    pick: 'object',
    target: `?hospexDocument`,
  },
  { type: 'add resources', variable: '?hospexDocument' },
  {
    type: 'match',
    subject: '?person',
    predicate: sioc.member_of,
    object: '?community',
    pick: 'graph',
    target: '?hospexDocumentForCommunity',
  },
  // remove all hospex documents that don't belong to this community
  qas => {
    const hospexDocuments = qas.getVariable('hospexDocument')
    const hospexDocumentsForCommunity = qas.getVariable(
      'hospexDocumentForCommunity',
    )

    const hospexDocumentsToRemove = difference(
      hospexDocuments,
      hospexDocumentsForCommunity,
    )

    hospexDocumentsToRemove.forEach(hd => {
      const quads = qas.store.getQuads(null, null, null, new n3.NamedNode(hd))

      quads.forEach(quad => qas.removeQuad(quad))
    })
  },
  {
    type: 'match',
    subject: '?person',
    predicate: hospex.offers,
    pick: 'object',
    target: '?offer',
  },
  { type: 'add resources', variable: '?offer' },
]

export const communityAccommodationsQuery: RdfQuery = [
  {
    type: 'match',
    subject: '?community',
    predicate: sioc.has_usergroup,
    pick: 'object',
    target: '?group',
  },
  {
    type: 'match',
    subject: '?group',
    predicate: vcard.hasMember,
    pick: 'object',
    target: '?person',
  },
  ...personAccommodationsQuery,
]

export const friendOfAFriendQuery: RdfQuery = [
  {
    type: 'match',
    subject: '?person',
    predicate: foaf.knows,
    pick: 'object',
    target: '?person',
  },
]

const personAccommodationQuery2 = [...personAccommodationsQuery].filter(
  step => typeof step !== 'function',
)
const offerIndex = personAccommodationQuery2.findIndex(
  step => 'target' in step && step.target === '?offer',
)
personAccommodationQuery2[offerIndex] = {
  type: 'match',
  subject: '?person',
  predicate: 'http://w3id.org/hospex/ns#offers',
  graph: '?hospexDocumentForCommunity',
  pick: 'object',
  target: '?offer',
}
export { personAccommodationQuery2 }
