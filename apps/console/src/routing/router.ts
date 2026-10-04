import { useMemo, useSyncExternalStore } from 'react'

export type RunnerTab = 'run' | 'knowledge' | 'inspector' | 'model-config'

export const runnerTabs: RunnerTab[] = ['run', 'knowledge', 'inspector', 'model-config']

// Every view and selection lives in the URL so reload, Back, and deep links work.
export type Route =
  | { name: 'setup'; scenarioId: string | null }
  | {
      name: 'runner'
      scenarioId: string
      tab: RunnerTab
      sessionId: string | null
      conversationId: string | null
    }
  | { name: 'not-found' }

export function parseRoute(pathname: string, search: string): Route {
  const parts = pathname
    .split('/')
    .filter((part) => part.length > 0)
    .map(decodeURIComponent)
  const [first, scenarioId, tab, ...rest] = parts

  if (first === undefined) return { name: 'setup', scenarioId: null }
  if (first !== 'scenarios' || rest.length > 0) return { name: 'not-found' }
  if (scenarioId === undefined) return { name: 'setup', scenarioId: null }
  if (tab === undefined) return { name: 'setup', scenarioId }
  if (!isRunnerTab(tab)) return { name: 'not-found' }

  const params = new URLSearchParams(search)
  return {
    name: 'runner',
    scenarioId,
    tab,
    sessionId: nonEmpty(params.get('session')),
    conversationId: nonEmpty(params.get('conversation')),
  }
}

export function formatRoute(route: Route): string {
  switch (route.name) {
    case 'not-found':
      return '/'
    case 'setup':
      return route.scenarioId === null ? '/' : `/scenarios/${encodeURIComponent(route.scenarioId)}`
    case 'runner': {
      const params = new URLSearchParams()
      if (route.sessionId !== null) params.set('session', route.sessionId)
      if (route.sessionId !== null && route.conversationId !== null) {
        params.set('conversation', route.conversationId)
      }
      const query = params.toString()
      const path = `/scenarios/${encodeURIComponent(route.scenarioId)}/${route.tab}`
      return query.length > 0 ? `${path}?${query}` : path
    }
  }
}

function isRunnerTab(value: string): value is RunnerTab {
  return (runnerTabs as string[]).includes(value)
}

function nonEmpty(value: string | null): string | null {
  return value === null || value.length === 0 ? null : value
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

function getHref(): string {
  return `${window.location.pathname}${window.location.search}`
}

export function useRoute(): Route {
  const href = useSyncExternalStore(subscribe, getHref, () => '/')
  return useMemo(() => {
    const url = new URL(href, 'http://localhost')
    return parseRoute(url.pathname, url.search)
  }, [href])
}

// Patches the runner route as it is *now*, so an async loader resolving late cannot undo a
// navigation that happened while it was in flight. Changing session drops the conversation.
export function updateRunnerRoute(
  patch: Partial<Pick<Extract<Route, { name: 'runner' }>, 'tab' | 'sessionId' | 'conversationId'>>,
  options: { replace?: boolean } = {},
): void {
  const current = parseRoute(window.location.pathname, window.location.search)
  if (current.name !== 'runner') return
  const sessionChanged = patch.sessionId !== undefined && patch.sessionId !== current.sessionId
  navigate(
    {
      ...current,
      ...patch,
      conversationId:
        'conversationId' in patch
          ? (patch.conversationId ?? null)
          : sessionChanged
            ? null
            : current.conversationId,
    },
    options,
  )
}

// User navigation pushes a history entry; automatic selection syncs (first session, the
// conversation a child view settled on) replace the current one so Back is not polluted.
export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const href = formatRoute(route)
  if (href === getHref()) return
  if (options.replace === true) window.history.replaceState(null, '', href)
  else window.history.pushState(null, '', href)
  listeners.forEach((listener) => {
    listener()
  })
}
