import {
  fetchRdfDocument,
  getVariableNames,
  LdhopEngine,
  type LdhopQuery,
  type LdhopQueryBuilder,
  type MixedVariables,
  type PlainVariable,
  type Variable,
} from '@ldhop/core'
import { useQueries, type QueryKey } from '@tanstack/react-query'
import { Quad, Store, type Term } from 'n3'
import { useEffect, useMemo, useRef, useState } from 'react'

type Fetch = typeof globalThis.fetch

export const DEFAULT_QUERY_KEY = 'rdfDocument'

const defaultQueryKeyFn = (resource: string): QueryKey => [
  DEFAULT_QUERY_KEY,
  resource,
]

let globalQueryKeyFn: (resource: string) => QueryKey = defaultQueryKeyFn

export const configureQueryKey = (fn: (resource: string) => QueryKey): void => {
  globalQueryKeyFn = fn
}

const getEmptyVariables = <V extends Variable>(
  query: LdhopQuery<V>,
): { [key in PlainVariable<V>]: Set<Term> } => {
  return Object.fromEntries(
    Array.from(getVariableNames(query)).map(
      v => [v.substring(1), new Set<Term>()] as const,
    ),
  ) as { [key in PlainVariable<V>]: Set<Term> }
}

export const useLdhopQuery = <
  V extends Variable,
  // AdditionalData extends object = object,
  S extends V = V,
>({
  query: queryInput,
  variables,
  fetch,
  getQueryKey = globalQueryKeyFn,
  staleTime = Infinity,
}: {
  query: LdhopQuery<V> | Omit<LdhopQueryBuilder<V, S>, 'add' | '_match'>
  variables: Partial<MixedVariables<V>>
  fetch: Fetch
  getQueryKey?: (resource: string) => QueryKey
  staleTime?: number
  // getAdditionalData?: (
  //   results: UseQueryResult<FetchRdfReturnType, Error>[],
  // ) => AdditionalData
}) => {
  const [resources, setResources] = useState<string[]>([])

  // convert query to array format
  const query = useMemo(() => [...queryInput], [queryInput])

  const [outputVariables, setOutputVariables] = useState<{
    [key in PlainVariable<V>]: Set<Term>
  }>(getEmptyVariables(query))
  const [outputStore, setOutputStore] = useState(new Store())
  const [outputQuads, setOutputQuads] = useState<Quad[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(true)

  // added resources with their hashed values
  const resourceRef = useRef<Map<string, string>>(new Map())

  const engineRef = useRef<LdhopEngine<V> | null>(null)
  useEffect(() => {
    setIsLoading(true)
    const store = new Store()
    setResources([])
    setOutputStore(store)
    setOutputQuads([])
    setOutputVariables(getEmptyVariables(query))
    resourceRef.current = new Map()
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
        resourceRef.current?.delete(uri)
      },
      onVariableAdded(this: LdhopEngine<V>) {
        const ov = this.getAllPlainVariables()
        if (ov) setOutputVariables(ov)
      },
      onVariableRemoved(this: LdhopEngine<V>) {
        const ov = this.getAllPlainVariables()
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
      const resource = resources[i]
      // if the resource is not needed, don't add it
      if (!graphs.has(resource)) return
      if (result.isSuccess) {
        // if the exact same graph is already added, ignore
        if (resourceRef.current?.get(resource) === result.data?.hash) return
        engineRef.current?.addGraph(
          result.data.response?.url ?? resources[i],
          result.data.data,
          resources[i],
        )
        // remember the graph
        resourceRef.current?.set(resource, result.data.hash)
      } else if (result.isError) {
        if (resourceRef.current?.get(resource) === 'error') return
        engineRef.current?.addGraph(resources[i], [])
        resourceRef.current?.set(resource, 'error')
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
