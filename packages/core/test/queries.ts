import * as n3 from 'n3'
import {
  as,
  dct,
  foaf,
  ldp,
  rdf,
  rdfs,
  sioc,
  solid,
  space,
  vcard,
} from 'rdf-namespaces'
import type { LdhopQuery, RdfQuery } from '../src/index.js'
import { getContainer } from '../src/utils/helpers.js'
import { hospex, meeting, wf } from './rdf-namespaces.js'

export enum Var {
  person = '?person',
  publicTypeIndex = '?publicTypeIndex',
  privateTypeIndex = '?privateTypeIndex',
  preferencesFile = '?preferencesFile',
  typeRegistration = '?typeRegistration',
  typeRegistrationForHospex = '?typeRegistrationForHospex',
  hospexDocument = '?hospexDocument',
  hospexDocumentForCommunity = '?hospexDocumentForCommunity',
  community = '?community',
  offer = '?offer',
  group = '?group',
  profileDocument = '?profileDocument',
  inbox = '?inbox',
  notification = '?notification',
  message = '?message',
  chat = '?chat',
  otherChat = '?otherChat',
  addNotification = '?addNotification',
  longChatNotification = '?longChatNotification',
  typeRegistrationForChat = '?typeRegistrationForChat',
  participation = '?participation',
  chatWithOtherPersonParticipation = '?chatWithOtherPersonParticipation',
  otherPerson = '?otherPerson',
  otherPersonParticipation = '?otherPersonParticipation',
  day = '?day',
  month = '?month',
  year = '?year',
  participant = '?participant',
  chatWithOtherPerson = '?chatWithOtherPerson',
  chatContainer = '?chatContainer',
  messageDoc = '?messageDoc',
}

export const personAccommodationsQuery: LdhopQuery<Var> = [
  {
    type: 'match',
    subject: Var.person,
    predicate: solid.publicTypeIndex,
    pick: 'object',
    target: Var.publicTypeIndex,
  },
  {
    type: 'match',
    subject: Var.publicTypeIndex,
    predicate: dct.references,
    pick: 'object',
    target: Var.typeRegistration,
  },
  {
    type: 'match',
    subject: Var.typeRegistration,
    predicate: solid.forClass,
    object: hospex.PersonalHospexDocument,
    pick: 'subject',
    target: Var.typeRegistrationForHospex,
  },
  {
    type: 'match',
    subject: Var.typeRegistrationForHospex,
    predicate: solid.instance,
    pick: 'object',
    target: Var.hospexDocument,
  },
  { type: 'add resources', variable: Var.hospexDocument },
  {
    type: 'match',
    subject: Var.person,
    predicate: sioc.member_of,
    object: Var.community,
    pick: 'graph',
    target: Var.hospexDocumentForCommunity,
  },
  {
    type: 'match',
    subject: Var.person,
    predicate: hospex.offers,
    graph: Var.hospexDocumentForCommunity,
    pick: 'object',
    target: Var.offer,
  },
  { type: 'add resources', variable: Var.offer },
]

export const personAccommodationsQuery2: RdfQuery<Var> = [
  {
    type: 'match',
    subject: Var.person,
    predicate: solid.publicTypeIndex,
    pick: 'object',
    target: Var.publicTypeIndex,
  },
  {
    type: 'match',
    subject: Var.publicTypeIndex,
    predicate: dct.references,
    pick: 'object',
    target: Var.typeRegistration,
  },
  {
    type: 'match',
    subject: Var.typeRegistration,
    predicate: solid.forClass,
    object: hospex.PersonalHospexDocument,
    pick: 'subject',
    target: Var.typeRegistrationForHospex,
  },
  {
    type: 'match',
    subject: Var.typeRegistrationForHospex,
    predicate: solid.instance,
    pick: 'object',
    target: Var.hospexDocument,
  },
  { type: 'add resources', variable: Var.hospexDocument },
  {
    type: 'match',
    subject: Var.person,
    predicate: sioc.member_of,
    object: Var.community,
    pick: 'graph',
    target: Var.hospexDocumentForCommunity,
  },
  // remove all hospex documents that don't belong to this community
  qas => {
    const hospexDocuments = qas.getVariable('hospexDocument')
    const hospexDocumentsForCommunity = qas.getVariable(
      'hospexDocumentForCommunity',
    )

    const hospexDocumentsToRemove = hospexDocuments.filter(
      hd => !hospexDocumentsForCommunity.includes(hd),
    )

    hospexDocumentsToRemove.forEach(hd => {
      const quads = qas.store.getQuads(null, null, null, new n3.NamedNode(hd))

      quads.forEach(quad => qas.removeQuad(quad))
    })
  },
  {
    type: 'match',
    subject: Var.person,
    predicate: hospex.offers,
    pick: 'object',
    target: Var.offer,
  },
  { type: 'add resources', variable: Var.offer },
]

export const communityAccommodationsQuery: LdhopQuery<Var> = [
  {
    type: 'match',
    subject: Var.community,
    predicate: sioc.has_usergroup,
    pick: 'object',
    target: Var.group,
  },
  {
    type: 'match',
    subject: Var.group,
    predicate: vcard.hasMember,
    pick: 'object',
    target: Var.person,
  },
  ...personAccommodationsQuery,
]

export const friendOfAFriendQuery: LdhopQuery<Var> = [
  {
    type: 'match',
    subject: Var.person,
    predicate: foaf.knows,
    pick: 'object',
    target: Var.person,
  },
]

export const inboxMessagesQuery: LdhopQuery<Var> = [
  {
    type: 'match',
    subject: Var.person,
    predicate: rdfs.seeAlso, // TODO also include foaf.isPrimaryTopicOf
    pick: 'object',
    target: Var.profileDocument,
  },
  // fetch the profile documents
  { type: 'add resources', variable: Var.profileDocument },
  {
    type: 'match',
    subject: Var.person,
    predicate: ldp.inbox,
    pick: 'object',
    target: Var.inbox,
  },
  {
    type: 'match',
    subject: Var.inbox,
    predicate: ldp.contains,
    pick: 'object',
    target: Var.notification,
  },
  {
    type: 'match',
    subject: Var.notification,
    predicate: rdf.type,
    object: as.Add,
    pick: 'subject',
    target: Var.addNotification,
  },
  {
    type: 'match',
    subject: Var.addNotification,
    predicate: as.context,
    object: 'https://www.pod-chat.com/LongChatMessage',
    pick: 'subject',
    target: Var.longChatNotification,
  },
  {
    type: 'match',
    subject: Var.longChatNotification,
    predicate: as.object,
    pick: 'object',
    target: Var.message,
  },
  { type: 'add resources', variable: Var.message },
  {
    type: 'match',
    subject: Var.longChatNotification,
    predicate: as.target,
    pick: 'object',
    target: Var.chat,
  },
  { type: 'add resources', variable: Var.chat },
]

export const communityQuery: LdhopQuery<Var> = [
  {
    type: 'match',
    subject: Var.community,
    predicate: sioc.has_usergroup,
    pick: 'object',
    target: Var.group,
  },
  {
    type: 'match',
    subject: Var.group,
    predicate: vcard.hasMember,
    pick: 'object',
    target: Var.person,
  },
]

export const chatsWithPerson: LdhopQuery<Var> = [
  {
    type: 'match',
    subject: Var.person,
    predicate: rdfs.seeAlso, // TODO also include foaf.isPrimaryTopicOf
    pick: 'object',
    target: Var.profileDocument,
  },
  // fetch the profile documents
  { type: 'add resources', variable: Var.profileDocument },
  {
    type: 'match',
    subject: Var.person,
    predicate: space.preferencesFile,
    pick: 'object',
    target: Var.preferencesFile,
  },
  { type: 'add resources', variable: Var.preferencesFile },
  // find and fetch private type index
  {
    type: 'match',
    subject: Var.person,
    predicate: solid.privateTypeIndex,
    pick: 'object',
    target: Var.privateTypeIndex,
  },
  {
    type: 'match',
    subject: Var.privateTypeIndex,
    predicate: dct.references,
    pick: 'object',
    target: Var.typeRegistration,
  },
  {
    type: 'match',
    subject: Var.typeRegistration,
    predicate: solid.forClass,
    object: meeting.LongChat,
    pick: 'subject',
    target: Var.typeRegistrationForChat,
  },
  {
    type: 'match',
    subject: Var.typeRegistrationForChat,
    predicate: solid.instance,
    pick: 'object',
    target: Var.chat,
  },
  {
    type: 'match',
    subject: Var.chat,
    predicate: wf.participation,
    pick: 'object',
    target: Var.participation,
  },
  {
    type: 'match',
    subject: Var.participation,
    predicate: wf.participant,
    pick: 'object',
    target: Var.participant,
  },
  {
    type: 'match',
    subject: Var.participation,
    predicate: wf.participant,
    object: Var.otherPerson,
    pick: 'subject',
    target: Var.otherPersonParticipation,
  },
  {
    type: 'match',
    subject: Var.chat,
    predicate: wf.participation,
    object: Var.otherPersonParticipation,
    pick: 'subject',
    target: Var.chatWithOtherPerson,
  },
  {
    type: 'match',
    subject: Var.chatWithOtherPerson,
    predicate: wf.participation,
    pick: 'object',
    target: Var.chatWithOtherPersonParticipation,
  },
  {
    type: 'match',
    subject: Var.chatWithOtherPersonParticipation,
    predicate: dct.references,
    pick: 'object',
    target: Var.otherChat,
  },
  // generate chat container
  {
    type: 'transform variable',
    source: Var.chatWithOtherPerson,
    target: Var.chatContainer,
    transform: term =>
      term.termType === 'NamedNode'
        ? new n3.NamedNode(getContainer(term.value))
        : undefined,
  },
  {
    type: 'transform variable',
    source: Var.otherChat,
    target: Var.chatContainer,
    transform: term =>
      term.termType === 'NamedNode'
        ? new n3.NamedNode(getContainer(term.value))
        : undefined,
  },
  {
    type: 'match',
    subject: Var.chatContainer,
    predicate: ldp.contains,
    pick: 'object',
    target: Var.year,
  },
  {
    type: 'match',
    subject: Var.year,
    predicate: ldp.contains,
    pick: 'object',
    target: Var.month,
  },
  {
    type: 'match',
    subject: Var.month,
    predicate: ldp.contains,
    pick: 'object',
    target: Var.day,
  },
  {
    type: 'match',
    subject: Var.day,
    predicate: ldp.contains,
    pick: 'object',
    target: Var.messageDoc,
  },
  { type: 'add resources', variable: Var.messageDoc },
  {
    type: 'match',
    subject: Var.chat,
    predicate: wf.message,
    pick: 'object',
    target: Var.message,
  },
  {
    type: 'match',
    subject: Var.otherChat,
    predicate: wf.message,
    pick: 'object',
    target: Var.message,
  },
]
