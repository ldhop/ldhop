import hash from '@emotion/hash'
import type { ParserOptions } from 'n3'
import { DataFactory, Parser, Quad } from 'n3'
import type { PromiseType, Required } from 'utility-types'

type URI = string
type Fetch = typeof globalThis.fetch

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

/**
 * Convert (http) uri to uri with https://
 */
export const https = (uri: URI): URI => {
  const url = new URL(uri)
  url.protocol = 'https'
  return url.toString()
}

/**
 * Fetch rdf document
 * parse it into rdf Dataset
 * add document url as graph
 */
export const fetchRdfDocument = async (uri: URI, fetch: Fetch) => {
  try {
    const doc = removeHashFromURI(uri)
    const res = await fullFetch(fetch)(doc)

    if (res.ok) {
      const data = await res.text()
      return {
        data: parseRdfToQuads(data, { baseIRI: doc }),
        rawData: data,
        hash: hash(data),
        ok: true,
        statusCode: res.status,
      }
    } else {
      return { data: [], rawData: '', ok: false, statusCode: res.status }
    }
  } catch {
    return { data: [], rawData: '', ok: false, statusCode: -1 }
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
