// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { formatRoute, parseRoute, type Route } from './router'

const ROUND_TRIP_CASES: [string, Route][] = [
  ['/scenarios', { name: 'scenario-list' }],
  ['/scenarios/new', { name: 'scenario-create' }],
  ['/model-config', { name: 'model-config' }],
  ['/scenarios/s1', { name: 'scenario-detail', scenarioId: 's1', mode: { kind: 'view' } }],
  [
    '/scenarios/s1/edit',
    { name: 'scenario-detail', scenarioId: 's1', mode: { kind: 'editing-scenario' } },
  ],
  [
    '/scenarios/s1/retrieval',
    { name: 'scenario-detail', scenarioId: 's1', mode: { kind: 'testing-retrieval' } },
  ],
  [
    '/scenarios/s1/avatars/new',
    { name: 'scenario-detail', scenarioId: 's1', mode: { kind: 'creating-avatar' } },
  ],
  [
    '/scenarios/s1/avatars/a1/edit',
    { name: 'scenario-detail', scenarioId: 's1', mode: { kind: 'editing-avatar', avatarId: 'a1' } },
  ],
  [
    '/scenarios/s1/knowledge/new',
    { name: 'scenario-detail', scenarioId: 's1', mode: { kind: 'creating-knowledge' } },
  ],
  [
    '/scenarios/s1/knowledge/k1/edit',
    {
      name: 'scenario-detail',
      scenarioId: 's1',
      mode: { kind: 'editing-knowledge', sourceId: 'k1' },
    },
  ],
  [
    '/scenarios/s1/knowledge/k1/chunks',
    {
      name: 'scenario-detail',
      scenarioId: 's1',
      mode: { kind: 'viewing-knowledge-chunks', sourceId: 'k1' },
    },
  ],
]

describe('admin router', () => {
  it.each(ROUND_TRIP_CASES)('round-trips %s', (path, route) => {
    expect(parseRoute(path)).toEqual(route)
    expect(formatRoute(route)).toBe(path)
  })

  it('treats the root and a trailing slash as the scenario list', () => {
    expect(parseRoute('/')).toEqual({ name: 'scenario-list' })
    expect(parseRoute('/scenarios/')).toEqual({ name: 'scenario-list' })
  })

  it('encodes and decodes ids with reserved characters', () => {
    const route: Route = { name: 'scenario-detail', scenarioId: 'a/b c', mode: { kind: 'view' } }

    expect(formatRoute(route)).toBe('/scenarios/a%2Fb%20c')
    expect(parseRoute('/scenarios/a%2Fb%20c')).toEqual(route)
  })

  it.each([
    '/unknown',
    '/scenarios/s1/unknown',
    '/scenarios/s1/avatars/a1',
    '/scenarios/s1/edit/extra',
  ])('reports %s as not found', (path) => {
    expect(parseRoute(path)).toEqual({ name: 'not-found' })
  })
})
