import { Quad } from 'n3'
import type { QueryAndStore } from '../src/QueryAndStore'
import { fetchRdf } from './resources'

export const run = (qas: QueryAndStore) => {
  let missingResources = qas.getMissingResources()

  while (missingResources.length > 0) {
    let quads: Quad[] = []
    const res = missingResources[0]
    try {
      quads = fetchRdf(missingResources[0])
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      qas.addResource(res, quads)
      missingResources = qas.getMissingResources()
    }
  }
}
