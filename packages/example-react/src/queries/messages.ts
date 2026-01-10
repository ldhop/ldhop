import type { RdfQuery } from '@ldhop/core'
import { NamedNode, type Term } from 'n3'
import { as, dct, ldp, rdf, solid, space } from 'rdf-namespaces'
import { getContainer } from '../utils/helpers'
import { meeting, wf } from '../utils/rdf-namespaces'
import { profileDocuments } from './profile'

export const inboxMessagesQuery = profileDocuments
  .match('?person', ldp.inbox)
  .o('?inbox')
  .match('?inbox', ldp.contains)
  .o('?notification')
  .match('?notification', rdf.type, as.Add)
  .s('?addNotification')
  .match(
    '?addNotification',
    as.context,
    'https://www.pod-chat.com/LongChatMessage',
  )
  .s('?longChatNotification')
  .match('?longChatNotification', as.object)
  .o('?message')
  .add()
  .match('?longChatNotification', as.target)
  .o('?chat')
  .add()

const chats = profileDocuments
  .match('?person', space.preferencesFile)
  .o('?preferencesFile')
  .add()
  .match('?person', solid.privateTypeIndex)
  .o('?privateTypeIndex')
  .match(null, rdf.type, solid.TypeRegistration, '?privateTypeIndex')
  .s('?typeRegistration')
  .match('?typeRegistration', solid.forClass, meeting.LongChat)
  .s('?typeRegistrationForChat')
  .match('?typeRegistrationForChat', solid.instance)
  .o('?chat')
  .match('?chat', wf.participation)
  .o('?participation')

const threadsQuery = chats
  .match('?participation', dct.references)
  .o('?otherChat')

const chatsWithPerson: RdfQuery = [
  ...chats,
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
]

const messageTree: RdfQuery = [
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

const getContainerNode = (term: Term) =>
  term.termType === 'NamedNode'
    ? new NamedNode(getContainer(term.value))
    : undefined

export const messages: RdfQuery = [
  ...chatsWithPerson,
  {
    type: 'transform variable',
    source: '?chatWithOtherPerson',
    target: '?chatContainer',
    transform: getContainerNode,
  },
  {
    type: 'transform variable',
    source: '?otherChat',
    target: '?chatContainer',
    transform: getContainerNode,
  },
  ...messageTree,
]

export const threads: RdfQuery = [
  ...threadsQuery,
  {
    type: 'transform variable',
    source: '?chat',
    target: '?chatContainer',
    transform: getContainerNode,
  },
  {
    type: 'transform variable',
    source: '?otherChat',
    target: '?chatContainer',
    transform: getContainerNode,
  },
  ...messageTree,
]
