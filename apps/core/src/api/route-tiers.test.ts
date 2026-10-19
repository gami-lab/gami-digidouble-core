import Fastify, { type RouteOptions } from 'fastify'
import { describe, expect, it } from 'vitest'
import { createServer } from './server.js'
import { TEST_CONFIG } from './routes/test-config.js'
import { enforceRouteTiers, registerTierScope } from './route-tiers.js'
import { playerHeaders, serviceKeyHeaders } from './routes/test-auth.js'

const OPEN_ROUTES = [
  'GET /health',
  'POST /v1/auth/player',
  'GET /v1/media/:assetId',
  'POST /v1/admin/auth/login',
]
const PLAYER_ROUTE_PATTERN = /^\/v1\/(sessions|conversations|me|scenarios\/?$)/
/** Path params the player ownership hook resolves; a new kind of id must extend that hook first. */
const OWNED_PATH_PARAMS = ['sessionId', 'conversationId', 'messageId']

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

  it('refuses a player token with 403 on every admin route', async () => {
    const routes = await listRegisteredRoutes()
    const app = createServer(TEST_CONFIG)

    const adminRoutes = routes.filter(({ tier }) => tier === 'admin')
    const statuses = await Promise.all(
      adminRoutes.map(async ({ route }) => {
        const [method, url] = route.split(' ')
        const response = await app.inject({
          method: method as 'GET',
          url: (url ?? '').replace(/:\w+/g, 'x'),
          headers: playerHeaders(),
        })
        return `${route} ${String(response.statusCode)}`
      }),
    )
    await app.close()

    expect(adminRoutes.length).toBeGreaterThan(30)
    expect(statuses.filter((status) => !status.endsWith(' 403'))).toEqual([])
  })

  it('names only resource params that the player ownership check covers', async () => {
    const routes = await listRegisteredRoutes()

    const uncovered = routes
      .filter(({ tier }) => tier === 'public')
      .flatMap(({ route }) =>
        [...route.matchAll(/:(\w+)/g)]
          .map((match) => match[1] ?? '')
          .filter((param) => !OWNED_PATH_PARAMS.includes(param))
          .map((param) => `${route} :${param}`),
      )
    expect(uncovered).toEqual([])
  })

  it('refuses the admin service key alone with 401 on every public route', async () => {
    const routes = await listRegisteredRoutes()
    const app = createServer(TEST_CONFIG)

    const publicRoutes = routes.filter(({ tier }) => tier === 'public')
    const statuses = await Promise.all(
      publicRoutes.map(async ({ route }) => {
        const [method, url] = route.split(' ')
        const response = await app.inject({
          method: method as 'GET',
          url: (url ?? '').replace(/:\w+/g, 'x'),
          headers: serviceKeyHeaders(),
        })
        return `${route} ${String(response.statusCode)}`
      }),
    )
    await app.close()

    expect(publicRoutes.length).toBeGreaterThan(15)
    expect(statuses.filter((status) => !status.endsWith(' 401'))).toEqual([])
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
