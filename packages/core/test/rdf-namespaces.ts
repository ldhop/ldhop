// not sure how to resolve errors resulting from this eslint rule
// it's because we overwrite exports from rdf-namespaces here
import * as ns from 'rdf-namespaces'

const base = {
  geo: 'http://www.w3.org/2003/01/geo/wgs84_pos#',
  hospex: 'http://w3id.org/hospex/ns#',
  meeting: 'http://www.w3.org/ns/pim/meeting#',
  ui: 'http://www.w3.org/ns/ui#',
  wf: 'http://www.w3.org/2005/01/wf/flow#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
} as const

export const hospex = {
  Accommodation: `${base.hospex}Accommodation`,
  PersonalHospexDocument: `${base.hospex}PersonalHospexDocument`,
  offers: `${base.hospex}offers`,
  offeredBy: `${base.hospex}offeredBy`,
  storage: `${base.hospex}storage`,
} as const

export const wf = {
  participation: `${base.wf}participation`,
  participant: `${base.wf}participant`,
  ...ns.wf,
} as const

export const meeting = {
  LongChat: `${base.meeting}LongChat`,
  ...ns.meeting,
} as const
