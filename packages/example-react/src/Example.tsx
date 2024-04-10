import { fetch } from '@inrupt/solid-client-authn-browser'
import { useLDhopQuery2 } from '@ldhop/react'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Graph } from './Graph'
import { readPersonAccommodationsQuery } from './queries'

const queryEntryCommunity = import.meta.env.VITE_QUERY_ENTRY_COMMUNITY
const queryEntryPerson = import.meta.env.VITE_QUERY_ENTRY_PERSON

if (!queryEntryCommunity) throw new Error('Please specify a community')

export const Example = () => {
  const { qas, variables, loading, missing, isLoading, isMissing, finished } =
    useLDhopQuery2(
      useMemo(
        () => ({
          query: readPersonAccommodationsQuery,
          variables: {
            community: [queryEntryCommunity],
            person: [queryEntryPerson],
          },
          fetch,
          limit: 30,
        }),
        [],
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

  const queryClient = useQueryClient()

  const handleInvalidate = () => {
    queryClient.invalidateQueries({
      queryKey: [
        'rdfDocument',
        'https://data.mrkvon.org/hospex/sleepy-bike/card',
      ],
    })
  }

  return (
    <>
      <button onClick={handleInvalidate}>Invalidate person</button>
      <div>
        {isLoading && 'loading'} {isMissing && 'missing'}
      </div>
      <div>offers: {variables.offer?.size}</div>
      <div>finished: {finished}</div>
      <div>missing: {missing}</div>
      <div>loading: {loading}</div>
      {/* <pre>{JSON.stringify(variablesCount, null, 2)}</pre> */}
      <Graph nodes={nodes} links={links} />
    </>
  )
}
