import { describe, expect, it } from 'vitest'
import { formatRoute, parseRoute, type Route } from './router'

describe('console router', () => {
  it.each<[string, Route]>([
    ['/', { name: 'setup', scenarioId: null }],
    ['/scenarios/sc_1', { name: 'setup', scenarioId: 'sc_1' }],
    [
      '/scenarios/sc_1/run',
      { name: 'runner', scenarioId: 'sc_1', tab: 'run', sessionId: null, conversationId: null },
    ],
    [
      '/scenarios/sc_1/inspector?session=se_1&conversation=co_1',
      {
        name: 'runner',
        scenarioId: 'sc_1',
        tab: 'inspector',
        sessionId: 'se_1',
        conversationId: 'co_1',
      },
    ],
  ])('round-trips %s', (href, route) => {
    const url = new URL(href, 'http://localhost')
    expect(parseRoute(url.pathname, url.search)).toEqual(route)
    expect(formatRoute(route)).toBe(href)
  })

  it('treats unknown paths and tabs as not found', () => {
    expect(parseRoute('/sessions', '')).toEqual({ name: 'not-found' })
    expect(parseRoute('/scenarios/sc_1/bogus', '')).toEqual({ name: 'not-found' })
    expect(parseRoute('/scenarios/sc_1/run/extra', '')).toEqual({ name: 'not-found' })
  })

  it('never puts a conversation in the URL without its session', () => {
    expect(
      formatRoute({
        name: 'runner',
        scenarioId: 'sc 1',
        tab: 'knowledge',
        sessionId: null,
        conversationId: 'co_1',
      }),
    ).toBe('/scenarios/sc%201/knowledge')
  })
})
