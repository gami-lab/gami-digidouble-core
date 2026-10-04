import { useCallback, useEffect, useRef, useState } from 'react'
import { formatApiError } from '../api/error'

export type AsyncState<T> = {
  data: T | null
  error: string | null
  isLoading: boolean
  reload: () => void
}

/** Loads data for the given key; a newer load always wins over a slower older one. */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const requestIdRef = useRef(0)
  const loadRef = useRef(load)
  loadRef.current = load

  const run = useCallback(() => {
    requestIdRef.current += 1
    const requestId = requestIdRef.current
    setIsLoading(true)
    loadRef
      .current()
      .then((value) => {
        if (requestId !== requestIdRef.current) return
        setData(value)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (requestId !== requestIdRef.current) return
        setError(formatApiError(loadError, 'Request failed'))
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setIsLoading(false)
      })
  }, [])

  useEffect(run, deps)

  return { data, error, isLoading, reload: run }
}
