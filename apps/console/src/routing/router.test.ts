import { describe, expect, it } from 'vitest'
import { formatRoute, parseRoute, type Route } from './router'

describe('console router', () => {
  it.each<[string, Route]>([
    ['/', { name: 'scenarios' }],
    ['/scenarios/sc_1', { name: 'scenario', scenarioId: 'sc_1', tab: 'sessions' }],
    ['/scenarios/sc_1/knowledge', { name: 'scenario', scenarioId: 'sc_1', tab: 'knowledge' }],
    ['/sessions/se_1', { name: 'session', sessionId: 'se_1', view: 'turns', turn: null }],
    [
      '/sessions/se_1?turn=corr_1',
      { name: 'session', sessionId: 'se_1', view: 'turns', turn: 'corr_1' },
    ],
    ['/sessions/se_1/memory', { name: 'session', sessionId: 'se_1', view: 'memory', turn: null }],
  ])('round-trips %s', (href, route) => {
    const url = new URL(href, 'http://localhost')
    expect(parseRoute(url.pathname, url.search)).toEqual(route)
    expect(formatRoute(route)).toBe(href)
  })

  it('treats unknown paths, tabs, and views as not found', () => {
    expect(parseRoute('/scenarios', '')).toEqual({ name: 'not-found' })
    expect(parseRoute('/scenarios/sc_1/bogus', '')).toEqual({ name: 'not-found' })
    expect(parseRoute('/sessions/se_1/bogus', '')).toEqual({ name: 'not-found' })
    expect(parseRoute('/sessions/se_1/memory/extra', '')).toEqual({ name: 'not-found' })
  })

  it('keeps the selected turn only on the turns view and encodes ids', () => {
    expect(
      formatRoute({ name: 'session', sessionId: 'se 1', view: 'context', turn: 'corr_1' }),
    ).toBe('/sessions/se%201/context')
  })
})
