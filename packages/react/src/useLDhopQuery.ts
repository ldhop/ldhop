import { QueryAndStore, RdfQuery } from '@ldhop/core'
import { fetchRdfDocument } from '@ldhop/core/dist/utils/helpers'
import { QueryKey, useQueries } from '@tanstack/react-query'
import mapValues from 'lodash/mapValues'
import type { Store } from 'n3'
import { useEffect, useMemo, useRef, useState } from 'react'

type Fetch = typeof globalThis.fetch

type Variables = { [variable: string]: string[] | undefined }

export const useLDhopQuery = ({
  query,
  variables,
  fetch,
  getQueryKey = resource => ['rdfResource', resource],
  staleTime = Infinity,
}: {
  query: RdfQuery
  variables: Variables
  fetch: Fetch
  getQueryKey?: (resource: string) => QueryKey
  staleTime?: number
}) => {
  const variableSets = useMemo(
    () => mapValues(variables, array => new Set(array)),
    [variables],
  )

  const [resources, setResources] = useState<string[]>([])
  const [outputVariables, setOutputVariables] = useState<Variables>({})
  const [outputStore, setOutputStore] = useState<Store>()

  const results = useQueries({
    queries: resources.map(resource => ({
      queryKey: getQueryKey(resource),
      queryFn: async () => ({
        ...(await fetchRdfDocument(resource, fetch)),
        resource,
      }),
      staleTime,
    })),
    combine: results => ({
      data: results
        .filter(result => result.status === 'success' && result.data)
        .map(result => ({
          data: result.data!.data,
          resource: result.data!.resource,
        })),
      pending: results.some(result => result.isPending),
    }),
  })

  const qas = useRef<QueryAndStore>(new QueryAndStore(query, variableSets))
  const lastResults = useRef<typeof results>(results)

  // if query or variables change, restart the query
  useEffect(() => {
    qas.current = new QueryAndStore(query, variableSets)
    setResources([])
  }, [query, variableSets])

  useEffect(() => {
    for (const result of results.data) {
      // find results that weren't added, yet
      if (!result || lastResults.current.data.includes(result)) continue
      // put them to QueryAndStore
      qas.current.addResource(result.resource, result.data)
    }

    // get resources that weren't added, and add them to resources
    const missingResources = qas.current.getMissingResources()

    setResources(resources => {
      const newResources: string[] = []
      for (const r of missingResources)
        if (!resources.includes(r)) newResources.push(r)

      if (newResources.length === 0) return resources
      else return [...resources, ...newResources]
    })

    setOutputVariables(
      mapValues(qas.current.getAllVariables(), uriSet => Array.from(uriSet)),
    )

    setOutputStore(qas.current.store)

    lastResults.current = results
  }, [resources, results])

  return useMemo(
    () => ({
      store: outputStore,
      variables: outputVariables,
      qas: qas.current,
    }),
    [outputStore, outputVariables],
  )
}
