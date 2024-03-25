import difference from 'lodash/difference'
import * as n3 from 'n3'
import { RdfQuery } from '../src'
import { getContainer } from '../src/utils/helpers'
import {
  as,
  dct,
  foaf,
  hospex,
  ldp,
  meeting,
  rdf,
  rdfs,
  sioc,
  solid,
  space,
  vcard,
  wf,
} from './rdf-namespaces'

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

export const inboxMessagesQuery: RdfQuery = [
  {
    type: 'match',
    subject: '?person',
    predicate: rdfs.seeAlso, // TODO also include foaf.isPrimaryTopicOf
    pick: 'object',
    target: '?profileDocument',
  },
  // fetch the profile documents
  { type: 'add resources', variable: '?profileDocument' },
  {
    type: 'match',
    subject: '?person',
    predicate: ldp.inbox,
    pick: 'object',
    target: '?inbox',
  },
  {
    type: 'match',
    subject: '?inbox',
    predicate: ldp.contains,
    pick: 'object',
    target: '?notification',
  },
  {
    type: 'match',
    subject: '?notification',
    predicate: rdf.type,
    object: as.Add,
    pick: 'subject',
    target: '?addNotification',
  },
  {
    type: 'match',
    subject: '?addNotification',
    predicate: as.context,
    object: 'https://www.pod-chat.com/LongChatMessage',
    pick: 'subject',
    target: '?longChatNotification',
  },
  {
    type: 'match',
    subject: '?longChatNotification',
    predicate: as.object,
    pick: 'object',
    target: '?message',
  },
  { type: 'add resources', variable: '?message' },
  {
    type: 'match',
    subject: '?longChatNotification',
    predicate: as.target,
    pick: 'object',
    target: '?chat',
  },
  { type: 'add resources', variable: '?chat' },
]

export const communityQuery: RdfQuery = [
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
]

export const chatsWithPerson: RdfQuery = [
  {
    type: 'match',
    subject: '?person',
    predicate: rdfs.seeAlso, // TODO also include foaf.isPrimaryTopicOf
    pick: 'object',
    target: '?profileDocument',
  },
  // fetch the profile documents
  { type: 'add resources', variable: '?profileDocument' },
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
  {
    type: 'match',
    subject: '?privateTypeIndex',
    predicate: dct.references,
    pick: 'object',
    target: '?typeRegistration',
  },
  {
    type: 'match',
    subject: '?typeRegistration',
    predicate: solid.forClass,
    object: meeting.LongChat,
    pick: 'subject',
    target: '?typeRegistrationForChat',
  },
  {
    type: 'match',
    subject: '?typeRegistrationForChat',
    predicate: solid.instance,
    pick: 'object',
    target: `?chat`,
  },
  {
    type: 'match',
    subject: '?chat',
    predicate: wf.participation,
    pick: 'object',
    target: '?participation',
  },
  {
    type: 'match',
    subject: '?participation',
    predicate: wf.participant,
    pick: 'object',
    target: '?participant',
  },
  {
    type: 'match',
    subject: '?participation',
    predicate: wf.participant,
    object: '?otherPerson',
    pick: 'subject',
    target: '?otherPersonParticipation',
  },
  {
    type: 'match',
    subject: '?participation',
    predicate: wf.participant,
    object: '?otherPerson',
    pick: 'subject',
    target: '?otherPersonParticipation',
  },
  {
    type: 'match',
    subject: '?chat',
    predicate: wf.participation,
    object: '?otherPersonParticipation',
    pick: 'subject',
    target: '?chatWithOtherPerson',
  },
  {
    type: 'match',
    subject: '?chatWithOtherPerson',
    predicate: wf.participation,
    pick: 'object',
    target: '?chatWithOtherPersonParticipation',
  },
  {
    type: 'match',
    subject: '?chatWithOtherPersonParticipation',
    predicate: dct.references,
    pick: 'object',
    target: '?otherChat',
  },
  // generate chat container
  {
    type: 'transform variable',
    source: '?chatWithOtherPerson',
    target: '?chatContainer',
    transform: getContainer,
  },
  {
    type: 'transform variable',
    source: '?otherChat',
    target: '?chatContainer',
    transform: getContainer,
  },
  {
    type: 'match',
    subject: '?chatContainer',
    predicate: ldp.contains,
    pick: 'object',
    target: '?year',
  },
  {
    type: 'match',
    subject: '?year',
    predicate: ldp.contains,
    pick: 'object',
    target: '?month',
  },
  {
    type: 'match',
    subject: '?month',
    predicate: ldp.contains,
    pick: 'object',
    target: '?day',
  },
  {
    type: 'match',
    subject: '?day',
    predicate: ldp.contains,
    pick: 'object',
    target: '?messageDoc',
  },
  { type: 'add resources', variable: '?messageDoc' },
  {
    type: 'match',
    subject: '?chat',
    predicate: wf.message,
    pick: 'object',
    target: '?message',
  },
  {
    type: 'match',
    subject: '?otherChat',
    predicate: wf.message,
    pick: 'object',
    target: '?message',
  },
]
