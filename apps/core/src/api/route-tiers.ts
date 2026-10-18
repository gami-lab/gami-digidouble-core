import type { FastifyInstance, RouteOptions } from 'fastify'

/**
 * `public` routes serve players, `admin` routes serve operators and tools, and `open` routes need
 * no credential (health check, credential issue/login).
 */
export type RouteTier = 'public' | 'admin' | 'open'

declare module 'fastify' {
  interface FastifyContextConfig {
    tier?: RouteTier
  }
}

/**
 * Registers a group of route plugins under `prefix` whose routes all default to `tier`. A route
 * may still declare its own tier in `config.tier` (for example an `open` login route under the
 * admin prefix); that declaration wins.
 */
export function registerTierScope(
  app: FastifyInstance,
  tier: RouteTier,
  prefix: string,
  register: (scope: FastifyInstance) => void,
): void {
  void app.register(
    (scope, _options, done) => {
      scope.addHook('onRoute', (route) => {
        route.config = { ...route.config, tier: route.config?.tier ?? tier }
      })
      register(scope)
      done()
    },
    { prefix },
  )
}

/**
 * Fails startup when any route lacks a tier, so an untagged route can never be served. CORS
 * preflight (`OPTIONS`) routes are answered by the CORS plugin and carry no tier.
 */
export function enforceRouteTiers(app: FastifyInstance): void {
  const routes: RouteOptions[] = []
  app.addHook('onRoute', (route) => {
    routes.push(route)
  })
  app.addHook('onReady', (done) => {
    const untagged = routes
      .filter((route) => route.method !== 'OPTIONS' && route.config?.tier === undefined)
      .map((route) => `${String(route.method)} ${route.url}`)
    done(
      untagged.length > 0 ? new Error(`Routes without a tier: ${untagged.join(', ')}`) : undefined,
    )
  })
}
