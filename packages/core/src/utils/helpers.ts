import { DataFactory, Parser, ParserOptions, Quad } from 'n3'
import type { Required } from 'utility-types'

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

/**
 * Get container which is a parent container of current resource or container
 */
export const getParent = (uri: URI): URI => {
  const container = getContainer(uri)
  return container === uri ? getParentContainer(container) : container
}

export const getAllParents = (uri: URI) => generateIteratively(uri, getParent)

/**
 * Return parent container of a container
 *
 * @example
 * https://example.com/asdf/ghjk/ -> https://example.com/asdf/
 * https://example.com/asdf/ -> https://example.com/
 * https://example.com/ -> https://example.com/
 *
 */
export const getParentContainer = (uri: URI): URI => {
  const url = new URL(uri)
  if (url.pathname.length === 0 || url.pathname === '/') return uri
  const pathPieces = url.pathname.split('/').slice(0, -2)
  pathPieces.push('')
  url.pathname = pathPieces.join('/')

  return url.toString()
}

export const fullFetch =
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
 * Find repeated values in a sequence generated based on a starting value and a generator function.
 * List of results doesn't include the starting value
 *
 * @template T - The type of values in the sequence.
 * @param {T} initialValue - The initial value to start the sequence.
 * @param {(prevValue: T) => T} generateNextValue - A function that generates the next value based on the previous value.
 * @returns {T[]} - An array containing the found values until the first repeated value.
 */
const generateIteratively = <T>(
  initialValue: T,
  generateNextValue: (prevValue: T) => T,
): T[] => {
  const seen = new Set<T>()
  let value: T = initialValue

  while (!seen.has(value)) {
    seen.add(value)
    value = generateNextValue(value)
  }

  seen.delete(initialValue)
  return Array.from(seen)
}

/**
 * Fetch rdf document
 * parse it into rdf Dataset
 * add document url as graph
 */
export const fetchRdfDocument = async (uri: URI, fetch: Fetch) => {
  const doc = removeHashFromURI(uri)
  const res = await fullFetch(fetch)(doc)

  if (res.ok) {
    const data = await res.text()
    return { data: parseRdfToQuads(data, { baseIRI: doc }), response: res }
  } else if (400 <= res.status && res.status < 500) {
    return { data: [], response: res }
  } else throw new Error(`Fetching ${doc} not successful`)
}

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
