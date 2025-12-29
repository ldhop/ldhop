import type { LdhopQuery, Variable } from './types.js'
export { getVariableNames, LdhopEngine } from './LdhopEngine.js'
export { QueryAndStore } from './QueryAndStore.js'
export {
  fetchRdfDocument,
  parseRdfToQuads as parseRdf,
  run,
  type FetchRdfReturnType,
} from './utils/helpers.js'

export type * from './types.js'

/**
 * A helper function to help with typing LdhopQuery and intellisense of the variables
 */
export function ldhopQuery<V extends Variable>(
  operations: LdhopQuery<V>,
): LdhopQuery<V> {
  return operations
}
