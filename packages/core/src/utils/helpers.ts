import hash from '@emotion/hash'
import type { ParserOptions } from 'n3'
import { DataFactory, Parser, Quad } from 'n3'
import type { PromiseType, Required } from 'utility-types'
import type { QueryAndStore } from '../index.js'
import type { LdhopEngine } from '../LdhopEngine.js'
import type { Variable } from '../types.js'

type URI = string
export type Fetch = typeof globalThis.fetch

const fetchWithRedirect =
  (fetch: Fetch): Fetch =>
  async (url, init) => {
    // first try to find final redirect
    const response = await globalThis.fetch(url, { method: 'GET' })
    // then fetch from this final redirect
    // hopefully a cors-compatible solid pod
    return await fetch(response.url, init)
  }

export const getContainer = (uri: URI): URI => {
  const url = new URL(uri)
  url.hash = ''
  url.search = ''
  if (url.pathname.length === 0 || url.pathname === '/') return url.toString()
  const pathPieces = url.pathname.split('/').slice(0, -1)
  pathPieces.push('')
  url.pathname = pathPieces.join('/')

  return url.toString()
}

const fullFetch =
  (fetch: Fetch): Fetch =>
  async (url, init) => {
    try {
      return await fetch(url, init)
    } catch (error) {
      return await fetchWithRedirect(fetch)(url, init)
    }
  }

export const removeHashFromURI = (uri: URI): URI => {
  const url = new URL(uri)
  url.hash = ''
  return url.toString()
}

const supportedMimeTypes = [
  'text/turtle',
  'application/trig',
  'application/n-triples',
  'application/n-quads',
  'text/n3',
]

/**
 * Fetch rdf document
 * parse it into rdf Dataset
 * add document url as graph
 */
export const fetchRdfDocument = async (uri: URI, fetch: Fetch) => {
  let data: Quad[] = []
  let rawData = ''
  let statusCode = -1
  let ok = false
  let response: Response | undefined = undefined

  try {
    const doc = removeHashFromURI(uri)
    response = await fullFetch(fetch)(doc, {
      headers: { accept: supportedMimeTypes.join(',') },
    })
    ok = response.ok
    statusCode = response.status
    rawData = await response.text()
    data = parseRdfToQuads(rawData, {
      baseIRI: doc,
      format: response.headers.get('content-type') ?? undefined,
    })

    return { data, rawData, hash: hash(rawData), ok, statusCode, response }
  } catch {
    ok = false
    return { data, rawData, hash: hash(rawData), ok, statusCode, response }
  }
}

export type FetchRdfReturnType = PromiseType<
  ReturnType<typeof fetchRdfDocument>
>

export const parseRdfToQuads = (
  data: string,
  options: Required<ParserOptions, 'baseIRI'>,
): Quad[] => {
  const parser = new Parser(options)
  // Parse the input data and add the resulting quads to the store
  const graph = DataFactory.namedNode(options.baseIRI)
  const quads = parser
    .parse(data)
    .map(({ subject, predicate, object }) =>
      DataFactory.quad(subject, predicate, object, graph),
    )

  return quads
}

/**
 * Follow your nose through the linked data graph by query
 */
export const run = async <V extends Variable>(
  qas: LdhopEngine<V> | QueryAndStore<V>,
  fetch: Fetch,
) => {
  let missingResources = qas.getMissingResources()

  while ([...missingResources].length > 0) {
    const missing = Array.from(missingResources)
    const res = missing[0]
    try {
      const { data: quads, response } = await fetchRdfDocument(
        missing[0],
        fetch,
      )
      qas.addResource(res, quads, response?.ok ? 'success' : 'error')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log((e as Error).message, (e as Error).stack?.slice(0, 1000))
      qas.addResource(res, [], 'error')
    } finally {
      missingResources = qas.getMissingResources()
    }
  }
}
