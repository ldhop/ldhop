import { fetch } from '@inrupt/solid-client-authn-browser'
import { type RdfQuery } from '@ldhop/core'
import { useLDhopQuery } from '@ldhop/react'
import { useMemo, useState } from 'react'
import { Graph } from './Graph'
import { friendOfAFriendQuerySolidCommunityFix } from './queries'

const queryEntryCommunity = import.meta.env.VITE_QUERY_ENTRY_COMMUNITY
const queryEntryPerson = import.meta.env.VITE_QUERY_ENTRY_PERSON

if (!queryEntryCommunity) throw new Error('Please specify a community')

const queryOptions: {
  [key: string]: {
    query: RdfQuery
    startingPoints: { [variable: string]: string[] | undefined }
  }
} = {
  empty: {
    query: [],
    startingPoints: {},
  },
  foaf: {
    query: friendOfAFriendQuerySolidCommunityFix,
    startingPoints: {
      community: [queryEntryCommunity],
      person: [queryEntryPerson],
    },
  },
}

export const Example = () => {
  const [selectedQuery, setSelectedQuery] = useState('foaf')

  const { qas, variables, isLoading, isMissing } = useLDhopQuery(
    useMemo(
      () => ({
        query: queryOptions[selectedQuery].query,
        variables: queryOptions[selectedQuery].startingPoints,
        fetch,
      }),
      [selectedQuery],
    ),
  )

  const { nodes, links } = useMemo(() => {
    const links: { source: string; target: string; step: number }[] = []

    const moves = qas.moves.list
    for (const move of moves) {
      const sources = Object.values(move.from)
        .flatMap(v => [...v])
        .map(v => v.value)
      const targets = Object.values(move.to)
        .flatMap(v => [...v])
        .map(v => v.value)
      if (sources.length !== 1) continue
      if (targets.length !== 1) continue
      for (const source of sources) {
        for (const target of targets) {
          if (source === target) continue
          links.push({ source, target, step: move.step })
        }
      }
    }

    const nodes: { [id: string]: Set<string> } = {}

    Object.entries(variables).forEach(([variable, uris]) => {
      uris?.forEach(uri => {
        nodes[uri] ??= new Set()
        nodes[uri].add(variable)
      })
    })

    return { nodes, links }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qas.moves.list.size, qas.moves.list, variables])

  return (
    <>
      <fieldset>
        {Object.keys(queryOptions).map(qo => (
          <div>
            <label>
              <input
                type="radio"
                name="queryOption"
                value={qo}
                checked={selectedQuery === qo}
                onChange={e => {
                  setSelectedQuery(e.target.value)
                }}
              />{' '}
              {qo}
            </label>
          </div>
        ))}
      </fieldset>
      <div>{isMissing && 'missing'}</div>
      <div>{isLoading && 'loading'}</div>
      {/* <pre>{JSON.stringify(variablesCount, null, 2)}</pre> */}
      <Graph nodes={nodes} links={links} />
    </>
  )
}
