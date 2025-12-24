import type { LdhopQuery, QueryVariables } from '@ldhop/core'
import { dct, sioc, solid, space } from 'rdf-namespaces'
import { hospex } from '../utils/rdf-namespaces'
import {
  personInbox,
  publicWebIdProfileQuery,
  webIdProfileQuery,
} from './profile'

// in public type index, find all personal hospex documents of the person for a particular community, and fetch them
const partialHospexDocumentQuery: LdhopQuery<
  | '?publicTypeIndex'
  | '?typeRegistration'
  | '?typeRegistrationForHospex'
  | '?hospexDocument'
  | '?person'
  | '?community'
  | '?hospexDocumentForCommunity'
> = [
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
]

export const hospexDocumentQuery: LdhopQuery<
  | QueryVariables<typeof publicWebIdProfileQuery>
  | QueryVariables<typeof partialHospexDocumentQuery>
> = [...publicWebIdProfileQuery, ...partialHospexDocumentQuery]

export const privateProfileAndHospexDocumentQuery: LdhopQuery<
  | QueryVariables<typeof webIdProfileQuery>
  | QueryVariables<typeof partialHospexDocumentQuery>
  | '?hospexSettings'
  | '?inbox'
> = [
  ...webIdProfileQuery,
  ...partialHospexDocumentQuery,
  {
    type: 'match',
    subject: '?person',
    predicate: space.preferencesFile,
    graph: '?hospexDocumentForCommunity',
    pick: 'object',
    target: '?hospexSettings',
  },
  personInbox,
]
