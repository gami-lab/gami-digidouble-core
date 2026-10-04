import { useMemo, useSyncExternalStore } from 'react'

export type ScenarioTab = 'sessions' | 'avatars' | 'knowledge'
export type SessionView = 'turns' | 'memory' | 'context'

export const scenarioTabs: ScenarioTab[] = ['sessions', 'avatars', 'knowledge']
export const sessionViews: SessionView[] = ['turns', 'memory', 'context']

// Every view and selection lives in the URL so reload, Back, and shared links reopen the same
// debug target.
export type Route =
  | { name: 'scenarios' }
  | { name: 'scenario'; scenarioId: string; tab: ScenarioTab }
  | { name: 'session'; sessionId: string; view: SessionView; turn: string | null }
  | { name: 'not-found' }

export function parseRoute(pathname: string, search: string): Route {
  const parts = pathname
    .split('/')
    .filter((part) => part.length > 0)
    .map(decodeURIComponent)
  const [first, id, sub, ...rest] = parts

  if (first === undefined) return { name: 'scenarios' }
  if (rest.length > 0 || id === undefined) return { name: 'not-found' }

  if (first === 'scenarios') return parseScenarioRoute(id, sub ?? 'sessions')
  if (first === 'sessions') return parseSessionRoute(id, sub ?? 'turns', search)
  return { name: 'not-found' }
}

function parseScenarioRoute(scenarioId: string, tab: string): Route {
  return isOneOf(scenarioTabs, tab) ? { name: 'scenario', scenarioId, tab } : { name: 'not-found' }
}

function parseSessionRoute(sessionId: string, view: string, search: string): Route {
  if (!isOneOf(sessionViews, view)) return { name: 'not-found' }
  const turn = new URLSearchParams(search).get('turn')
  return { name: 'session', sessionId, view, turn: turn === '' ? null : turn }
}

export function formatRoute(route: Route): string {
  switch (route.name) {
    case 'scenarios':
    case 'not-found':
      return '/'
    case 'scenario':
      return `/scenarios/${encodeURIComponent(route.scenarioId)}${
        route.tab === 'sessions' ? '' : `/${route.tab}`
      }`
    case 'session': {
      const path = `/sessions/${encodeURIComponent(route.sessionId)}${
        route.view === 'turns' ? '' : `/${route.view}`
      }`
      return route.view === 'turns' && route.turn !== null
        ? `${path}?turn=${encodeURIComponent(route.turn)}`
        : path
    }
  }
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value)
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

// User navigation pushes a history entry; automatic selections replace the current one so Back is
// not polluted.
export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const href = formatRoute(route)
  if (href === getHref()) return
  if (options.replace === true) window.history.replaceState(null, '', href)
  else window.history.pushState(null, '', href)
  listeners.forEach((listener) => {
    listener()
  })
}
