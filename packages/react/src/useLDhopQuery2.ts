import { QueryAndStore, fetchRdfDocument, type RdfQuery } from '@ldhop/core'
import { QueryObserver, useQueryClient } from '@tanstack/react-query'
import mapValues from 'lodash/mapValues.js'
import { Quad } from 'n3'
import { useEffect, useMemo, useRef, useState } from 'react'

type Fetch = typeof globalThis.fetch
type Variables = { [variable: string]: string[] | undefined }

const wait = (t: number) =>
  new Promise(resolve => {
    setTimeout(resolve, t)
  })

// logTick(Date.now())

const useLDhopQuery2 = ({
  query,
  variables,
  fetch,
  limit = 1,
}: {
  query: RdfQuery
  variables: Variables
  fetch: Fetch
  limit?: number
}) => {
  const variableSets = useMemo(
    () => mapValues(variables, array => new Set(array)),
    [variables],
  )

  const queryClient = useQueryClient()

  const qasRef = useRef(new QueryAndStore(query, variableSets))
  const finished = useRef(new Set<string>()) // finished processing
  const fetching = useRef(new Set<string>()) // fetching started
  const missing = useRef(new Set<string>())
  const stillHere = useRef(true)
  const unsubscribeMap = useRef(new Map<string, () => void>())

  const [quads, setQuads] = useState<Quad[]>()
  const [outputVariables, setOutputVariables] = useState(
    qasRef.current.getAllVariables(),
  )

  useEffect(() => {
    stillHere.current = true
    const unsubs = unsubscribeMap.current
    // initialize variables
    const addMissingResources = () => {
      const mrs = qasRef.current.getMissingResources()
      for (const mr of mrs) {
        if (fetching.current.has(mr)) continue
        if (finished.current.has(mr)) continue
        missing.current.add(mr)
      }
    }

    // TODO tentative name
    const doResource = async (resource: string) => {
      if (!missing.current.has(resource)) return
      fetching.current.add(resource)
      missing.current.delete(resource)
      await wait(0) // allow a tick to happen even when react-query is taking response synchronously from cache
      const response = await queryClient.fetchQuery({
        queryKey: ['rdfDocument', resource],
        queryFn: () => fetchRdfDocument(resource, fetch),
        staleTime: Infinity,
      })
      fetching.current.delete(resource)
      finished.current.add(resource)
      qasRef.current.addResource(
        resource,
        response.data,
        response.ok ? 'success' : 'error',
      )
      // create subscription for the resource if it doesn't exist
      if (!unsubscribeMap.current.has(resource)) {
        const observer = new QueryObserver<{
          data: Quad[]
          rawData: string
          hash: string
          ok: boolean
          statusCode: number
          response: Response | undefined
        }>(queryClient, {
          queryKey: ['rdfDocument', resource],
          queryFn: () => fetchRdfDocument(resource, fetch),
          staleTime: Infinity,
        })

        if (stillHere.current) {
          const unsubscribe = observer.subscribe(async result => {
            if (result.fetchStatus === 'fetching')
              fetching.current.add(resource)
            if (result.isSuccess && result.data) {
              qasRef.current.addResource(resource, result.data.data)
              setQuads(qasRef.current.store.getQuads(null, null, null, null))
              setOutputVariables(qasRef.current.getAllVariables())
              addMissingResources()
              startStoppedLoop()
            }
            if (result.fetchStatus === 'idle') fetching.current.delete(resource)
          })

          unsubscribeMap.current.set(resource, unsubscribe)
        }
      }

      setQuads(qasRef.current.store.getQuads(null, null, null, null))
      setOutputVariables(qasRef.current.getAllVariables())
      if (stillHere.current) {
        addMissingResources()
        startStoppedLoop()
      }
    }

    function startStoppedLoop() {
      if (fetching.current.size > limit) return
      if (missing.current.size === 0) return

      // how many available fetching spots?
      const available = limit - fetching.current.size
      if (!available) return
      ;[...missing.current].slice(-available, Infinity).forEach(resource => {
        doResource(resource)
      })
    }

    addMissingResources()
    startStoppedLoop()

    return () => {
      stillHere.current = false
      unsubs.forEach((value, key, map) => {
        value()
        map.delete(key)
      })
    }
  }, [fetch, limit, queryClient])

  return useMemo(
    () => ({
      quads,
      qas: qasRef.current,
      loading: fetching.current.size,
      missing: missing.current.size,
      finished: finished.current.size,
      isMissing: missing.current.size > 0,
      isLoading: fetching.current.size > 0,
      variables: outputVariables,
    }),
    [outputVariables, quads],
  )
}

export { useLDhopQuery2 }
