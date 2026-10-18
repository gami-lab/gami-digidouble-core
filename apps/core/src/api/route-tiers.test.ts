import Fastify, { type RouteOptions } from 'fastify'
import { describe, expect, it } from 'vitest'
import { createServer } from './server.js'
import { TEST_CONFIG } from './routes/test-config.js'
import { enforceRouteTiers, registerTierScope } from './route-tiers.js'

const OPEN_ROUTES = ['GET /health', 'POST /v1/admin/auth/login']
const PLAYER_ROUTE_PATTERN = /^\/v1\/(sessions|conversations|users|scenarios\/?$)/

async function listRegisteredRoutes(): Promise<{ route: string; tier: unknown }[]> {
  const app = createServer(TEST_CONFIG)
  const routes: RouteOptions[] = []
  app.addHook('onRoute', (route) => {
    routes.push(route)
  })
  await app.ready()
  await app.close()
  return routes
    .filter((route) => route.method !== 'OPTIONS' && route.method !== 'HEAD')
    .map((route) => ({
      route: `${String(route.method)} ${route.url.replace(/(.)\/$/, '$1')}`,
      tier: route.config?.tier,
    }))
}

describe('route tier matrix', () => {
  it('gives every registered route exactly one tier', async () => {
    const routes = await listRegisteredRoutes()

    expect(routes.length).toBeGreaterThan(50)
    expect(routes.filter(({ tier }) => tier === undefined)).toEqual([])
  })

  it('serves every /v1/admin route on the admin tier except the explicit open routes', async () => {
    const routes = await listRegisteredRoutes()

    const adminPrefixed = routes.filter(
      ({ route }) => route.split(' ')[1]?.startsWith('/v1/admin') && !OPEN_ROUTES.includes(route),
    )
    expect(adminPrefixed.length).toBeGreaterThan(0)
    expect(adminPrefixed.filter(({ tier }) => tier !== 'admin')).toEqual([])
  })

  it('keeps the public tier to player routes only', async () => {
    const routes = await listRegisteredRoutes()

    const publicRoutes = routes.filter(({ tier }) => tier === 'public')
    expect(
      publicRoutes.filter(({ route }) => !PLAYER_ROUTE_PATTERN.test(route.split(' ')[1] ?? '')),
    ).toEqual([])
  })

  it('limits the open tier to the explicit credential-free routes', async () => {
    const routes = await listRegisteredRoutes()

    expect(routes.filter(({ tier }) => tier === 'open').map(({ route }) => route)).toEqual(
      OPEN_ROUTES,
    )
  })

  it('fails startup when a route has no tier', async () => {
    const app = Fastify()
    enforceRouteTiers(app)
    app.get('/untagged', () => 'ok')

    await expect(app.ready()).rejects.toThrow('Routes without a tier: GET /untagged')
  })

  it('lets a route declare its own tier inside a tier scope', async () => {
    const app = Fastify()
    enforceRouteTiers(app)
    registerTierScope(app, 'admin', '/v1/admin', (scope) => {
      scope.get('/scoped', (request) => request.routeOptions.config.tier)
      scope.get('/declared', { config: { tier: 'open' } }, (request) => {
        return request.routeOptions.config.tier
      })
    })
    await app.ready()

    const scoped = await app.inject({ method: 'GET', url: '/v1/admin/scoped' })
    const declared = await app.inject({ method: 'GET', url: '/v1/admin/declared' })
    expect(scoped.body).toBe('admin')
    expect(declared.body).toBe('open')
    await app.close()
  })
})
