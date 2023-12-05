import { readFileSync } from 'fs'
import { join } from 'path'
import { parseRdfToQuads } from '../../src/utils/helpers'

export const fetch = (uri: string) => {
  const url = new URL(uri)

  const filename = join(__dirname, url.host, url.pathname + '.ttl')
  const data = readFileSync(filename, 'utf8')
  return data
}

export const fetchRdf = (uri: string) => {
  const data = fetch(uri)
  return parseRdfToQuads(data, { baseIRI: uri })
}
