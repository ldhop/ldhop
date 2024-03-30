import { fetch } from '@inrupt/solid-client-authn-browser'
import { useLDhopQuery } from '@ldhop/react'
import { useMemo } from 'react'
import { Graph } from './Graph'
import { searchAccommodationsQuery } from './queries'

const queryEntryCommunity = import.meta.env.VITE_QUERY_ENTRY_COMMUNITY

if (!queryEntryCommunity) throw new Error('Please specify a community')

export const Example = () => {
  const { qas, variables, isLoading, isMissing } = useLDhopQuery(
    useMemo(
      () => ({
        query: searchAccommodationsQuery,
        variables: { community: [queryEntryCommunity] },
        fetch,
      }),
      [],
    ),
  )

  const { nodes, links } = useMemo(() => {
    const links: { source: string; target: string; step: number }[] = []

    const moves = qas.moves.list
    for (const move of moves) {
      const sources = Object.values(move.from).flatMap(v => [...v])
      const targets = Object.values(move.to).flatMap(v => [...v])
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
      <div>{isMissing && 'missing'}</div>
      <div>{isLoading && 'loading'}</div>
      {/* <pre>{JSON.stringify(variablesCount, null, 2)}</pre> */}
      <Graph nodes={nodes} links={links} />
    </>
  )
}
