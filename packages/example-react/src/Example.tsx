import { fetch } from '@inrupt/solid-client-authn-browser'
import { LdhopQuery, QueryVariables, Variable } from '@ldhop/core'
import { useLdhopQuery } from '@ldhop/react'
import { useMemo, useState } from 'react'
import { Graph } from './Graph'
import {
  friendOfAFriendQuerySolidCommunityFix,
  hospexDocumentQuery,
} from './queries'

const queryEntryCommunity = import.meta.env.VITE_QUERY_ENTRY_COMMUNITY
const queryEntryPerson = import.meta.env.VITE_QUERY_ENTRY_PERSON

if (!queryEntryCommunity) throw new Error('Please specify a community')

interface QueryOption<V extends Variable> {
  query: LdhopQuery<V>
  startingPoints: Partial<{ [v in V]: Set<string> }>
}

const queryOptions: {
  empty: QueryOption<never>
  foaf: QueryOption<
    QueryVariables<typeof friendOfAFriendQuerySolidCommunityFix>
  >
  hospex: QueryOption<QueryVariables<typeof hospexDocumentQuery>>
} = {
  empty: {
    query: [],
    startingPoints: {},
  },
  foaf: {
    query: friendOfAFriendQuerySolidCommunityFix,
    startingPoints: {
      '?person': new Set([queryEntryPerson]),
    },
  },
  hospex: {
    query: hospexDocumentQuery,
    startingPoints: {
      '?community': new Set([queryEntryCommunity]),
      '?person': new Set([queryEntryPerson]),
    },
  },
}

export const Example = () => {
  const [selectedQuery, setSelectedQuery] =
    useState<keyof typeof queryOptions>('foaf')

  const { engine, variables, isLoading, isMissing, quads, isFetching } =
    useLdhopQuery(
      useMemo(
        () => ({
          query: queryOptions[selectedQuery].query,
          variables: queryOptions[selectedQuery].startingPoints,
          fetch,
          staleTime: 10000,
        }),
        [selectedQuery],
      ),
    )

  const { nodes, links } = useMemo(() => {
    const links: { source: string; target: string; step: number }[] = []

    const moves = engine?.moves.list

    if (moves)
      for (const move of moves) {
        const sources = Array.from(move.from.values())
          .flatMap(v => Array.from(v.values()))
          .map(v => v.value)
        const targets = Array.from(move.to.values())
          .flatMap(v => Array.from(v.values()))
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
        nodes[uri.value] ??= new Set()
        nodes[uri.value].add(variable)
      })
    })

    return { nodes, links }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine?.moves.list.size, engine?.moves.list, variables])

  return (
    <>
      <fieldset>
        {Object.keys(queryOptions).map(qo => (
          <div key={qo}>
            <label>
              <input
                type="radio"
                name="queryOption"
                value={qo}
                checked={selectedQuery === qo}
                onChange={e => {
                  setSelectedQuery(e.target.value as keyof typeof queryOptions)
                }}
              />{' '}
              {qo}
            </label>
          </div>
        ))}
      </fieldset>
      <div>{isMissing && 'missing'}</div>
      <div>{isFetching && 'fetching'}</div>
      <div>{isLoading && 'loading'}</div>
      <div>{quads.length}</div>
      {/* <pre>{JSON.stringify(variablesCount, null, 2)}</pre> */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <pre>
          {JSON.stringify(
            variables,

            (_key, value) => {
              if (value instanceof Set) {
                return Array.from(value).map(v => `${v.termType}:${v.value}`)
              }
              return value
            },
            2,
          )}
        </pre>
        <Graph nodes={nodes} links={links} />
      </div>
    </>
  )
}
