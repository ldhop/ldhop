import {
  fetchRdfDocument,
  LdhopEngine,
  type FetchRdfReturnType,
  type LdhopQuery,
  type UriVariables,
  type Variable,
} from '@ldhop/core'
import {
  useQueries,
  type QueryKey,
  type UseQueryResult,
} from '@tanstack/react-query'
import { Quad, Store, type Term } from 'n3'
import { useEffect, useMemo, useRef, useState } from 'react'

type Fetch = typeof globalThis.fetch

export const useLdhopQuery = <
  V extends Variable,
  AdditionalData extends object = object,
>({
  query,
  variables,
  fetch,
  getQueryKey = resource => ['rdfDocument', resource],
  staleTime = Infinity,
}: {
  query: LdhopQuery<V>
  variables: UriVariables<V>
  fetch: Fetch
  getQueryKey?: (resource: string) => QueryKey
  staleTime?: number
  getAdditionalData?: (
    results: UseQueryResult<FetchRdfReturnType, Error>[],
  ) => AdditionalData
}) => {
  const [resources, setResources] = useState<string[]>([])

  const [outputVariables, setOutputVariables] = useState<
    Partial<{ [key in V]: Set<Term> }>
  >({})
  const [outputStore, setOutputStore] = useState(new Store())
  const [outputQuads, setOutputQuads] = useState<Quad[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(true)

  const engineRef = useRef<LdhopEngine<V> | null>(null)
  useEffect(() => {
    setIsLoading(true)
    const store = new Store()
    setResources([])
    setOutputStore(store)
    setOutputQuads([])
    engineRef.current = new LdhopEngine(query, variables, store, {
      onNeedResource: uri => {
        setIsLoading(true)
        setResources(resources =>
          resources.includes(uri) ? resources : [...resources, uri],
        )
      },
      onDropResource: uri => {
        setResources(resources =>
          resources.includes(uri)
            ? resources.filter(resource => resource !== uri)
            : resources,
        )
      },
      onVariableAdded(this: LdhopEngine<V>) {
        const ov = this.getAllVariables()
        if (ov) setOutputVariables(ov)
      },
      onVariableRemoved(this: LdhopEngine<V>) {
        const ov = this.getAllVariables()
        if (ov) setOutputVariables(ov)
      },
      onQueryComplete() {
        setIsLoading(false)
      },
      onQuadsChanged(this: LdhopEngine<V>) {
        const quads = this.store.getQuads(null, null, null, null) ?? []
        setOutputQuads(quads)
      },
    })
    setOutputStore(engineRef.current.store)

    return () => {
      delete engineRef.current?.onDropResource
      delete engineRef.current?.onNeedResource
      delete engineRef.current?.onQuadsChanged
      delete engineRef.current?.onQueryComplete
      delete engineRef.current?.onVariableAdded
      delete engineRef.current?.onVariableRemoved
      engineRef.current = null
    }
  }, [query, variables])

  const results = useQueries(
    useMemo(
      () => ({
        queries: resources.map(resource => ({
          queryKey: getQueryKey(resource),
          queryFn: () => fetchRdfDocument(resource, fetch),
          staleTime,
        })),
      }),
      [fetch, getQueryKey, resources, staleTime],
    ),
  )

  useEffect(() => {
    const graphs = engineRef.current?.getGraphs() ?? new Set()
    results.forEach((result, i) => {
      // if the resource is not needed, don't add it
      if (!graphs.has(resources[i])) return
      if (result.isSuccess) {
        engineRef.current?.addGraph(
          result.data.response?.url ?? resources[i],
          result.data.data,
          resources[i],
        )
      } else if (result.isError) {
        engineRef.current?.addGraph(resources[i], [])
      }
    })

    const isFetching = results.some(r => r.isFetching)
    setIsFetching(isFetching)
  }, [resources, results])

  return useMemo(
    () => ({
      store: outputStore,
      quads: outputQuads,
      variables: outputVariables,
      engine: engineRef.current,
      isLoading,
      isMissing: false,
      isFetching,
    }),
    [isFetching, isLoading, outputQuads, outputStore, outputVariables],
  )
}
