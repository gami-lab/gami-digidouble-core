import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react'

// Sub-views of one scenario. Each one has its own URL so reload, Back, and deep links work.
export type DetailMode =
  | { kind: 'view' }
  | { kind: 'editing-scenario' }
  | { kind: 'creating-avatar' }
  | { kind: 'editing-avatar'; avatarId: string }
  | { kind: 'creating-knowledge' }
  | { kind: 'editing-knowledge'; sourceId: string }
  | { kind: 'viewing-knowledge-chunks'; sourceId: string }
  | { kind: 'testing-retrieval' }

export type Route =
  | { name: 'scenario-list' }
  | { name: 'scenario-create' }
  | { name: 'scenario-detail'; scenarioId: string; mode: DetailMode }
  | { name: 'model-config' }
  | { name: 'not-found' }

type HistoryState = { from?: string; scrollY?: number } | null

// '' in dev, '/admin' in the production build (see vite.config.ts).
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '')

export function parseRoute(pathname: string): Route {
  const path = pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname
  const parts = path
    .split('/')
    .filter((part) => part.length > 0)
    .map(decodeURIComponent)
  const [first, second, ...rest] = parts

  if (first === undefined) return { name: 'scenario-list' }
  if (first === 'model-config' && second === undefined) return { name: 'model-config' }
  if (first !== 'scenarios') return { name: 'not-found' }
  if (second === undefined) return { name: 'scenario-list' }
  if (second === 'new' && rest.length === 0) return { name: 'scenario-create' }

  const mode = parseDetailMode(rest)
  return mode === null
    ? { name: 'not-found' }
    : { name: 'scenario-detail', scenarioId: second, mode }
}

// ':id' segments are captured in order and passed to the builder.
const DETAIL_MODE_PATTERNS: [string[], (ids: string[]) => DetailMode][] = [
  [[], () => ({ kind: 'view' })],
  [['edit'], () => ({ kind: 'editing-scenario' })],
  [['retrieval'], () => ({ kind: 'testing-retrieval' })],
  [['avatars', 'new'], () => ({ kind: 'creating-avatar' })],
  [['avatars', ':id', 'edit'], ([avatarId = '']) => ({ kind: 'editing-avatar', avatarId })],
  [['knowledge', 'new'], () => ({ kind: 'creating-knowledge' })],
  [['knowledge', ':id', 'edit'], ([sourceId = '']) => ({ kind: 'editing-knowledge', sourceId })],
  [
    ['knowledge', ':id', 'chunks'],
    ([sourceId = '']) => ({ kind: 'viewing-knowledge-chunks', sourceId }),
  ],
]

function parseDetailMode(parts: string[]): DetailMode | null {
  for (const [pattern, build] of DETAIL_MODE_PATTERNS) {
    const ids = matchPattern(pattern, parts)
    if (ids !== null) return build(ids)
  }
  return null
}

function matchPattern(pattern: string[], parts: string[]): string[] | null {
  if (pattern.length !== parts.length) return null
  const ids: string[] = []
  for (const [index, segment] of pattern.entries()) {
    const part = parts[index] ?? ''
    if (segment === ':id') ids.push(part)
    else if (segment !== part) return null
  }
  return ids
}

export function formatRoute(route: Route): string {
  return `${BASE_PATH}${formatPath(route)}`
}

function formatPath(route: Route): string {
  switch (route.name) {
    case 'scenario-list':
    case 'not-found':
      return '/scenarios'
    case 'scenario-create':
      return '/scenarios/new'
    case 'model-config':
      return '/model-config'
    case 'scenario-detail':
      return `/scenarios/${encodeURIComponent(route.scenarioId)}${formatDetailMode(route.mode)}`
  }
}

function formatDetailMode(mode: DetailMode): string {
  switch (mode.kind) {
    case 'view':
      return ''
    case 'editing-scenario':
      return '/edit'
    case 'testing-retrieval':
      return '/retrieval'
    case 'creating-avatar':
      return '/avatars/new'
    case 'editing-avatar':
      return `/avatars/${encodeURIComponent(mode.avatarId)}/edit`
    case 'creating-knowledge':
      return '/knowledge/new'
    case 'editing-knowledge':
      return `/knowledge/${encodeURIComponent(mode.sourceId)}/edit`
    case 'viewing-knowledge-chunks':
      return `/knowledge/${encodeURIComponent(mode.sourceId)}/chunks`
  }
}

const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => {
    listener()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

function getPathname(): string {
  return window.location.pathname
}

function readHistoryState(): HistoryState {
  return window.history.state as HistoryState
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, getPathname)
  return useMemo(() => parseRoute(pathname), [pathname])
}

// Pushes a new history entry. The entry being left remembers its scroll position, and the new
// entry remembers where it came from so `navigateUp` can return with a real Back.
export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const href = formatRoute(route)
  if (href === window.location.pathname) return

  if (options.replace === true) {
    window.history.replaceState({ from: readHistoryState()?.from }, '', href)
  } else {
    window.history.replaceState({ ...readHistoryState(), scrollY: window.scrollY }, '')
    window.history.pushState({ from: window.location.pathname }, '', href)
  }
  notify()
}

// Leaves a sub-view (Cancel/Save): goes Back when the parent is the previous entry, so the
// history does not grow parent → child → parent; otherwise replaces the current entry.
export function navigateUp(route: Route): void {
  if (readHistoryState()?.from === formatRoute(route)) {
    window.history.back()
    return
  }
  navigate(route, { replace: true })
}

// New entries start at the top; Back/Forward restore the scroll saved when the entry was left.
export function useScrollRestoration(route: Route): void {
  useEffect(() => {
    window.history.scrollRestoration = 'manual'
  }, [])

  useLayoutEffect(() => {
    window.scrollTo(0, readHistoryState()?.scrollY ?? 0)
  }, [route])
}

export function useDocumentTitle(parts: string[]): void {
  const title = [...parts].reverse().join(' · ')
  useEffect(() => {
    document.title = `${title} — Gami Admin`
  }, [title])
}
