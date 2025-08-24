import { readFileSync } from 'fs'
import { join } from 'path'
import { LdhopEngine, QueryAndStore, Variable } from '../src/index.js'
import { type Fetch, run as runWithFetch } from '../src/utils/helpers.js'

// get current working directory
const __dirname = process.cwd()

const staticFetch = (async (uri: string) => {
  const url = new URL(uri)

  const filename = join(
    __dirname,
    'test/resources',
    url.host,
    url.pathname + '.ttl',
  )
  const data = readFileSync(filename, 'utf8')
  return {
    ok: true,
    text: async () => data,
    status: 200,
    headers: new Headers(),
  }
}) as Fetch

export const run = <V extends Variable = Variable>(
  qas: QueryAndStore<V> | LdhopEngine<V>,
) => runWithFetch<V>(qas, staticFetch)
