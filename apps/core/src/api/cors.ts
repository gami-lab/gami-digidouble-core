import cors, {
  type FastifyCorsOptions,
  type FastifyCorsOptionsDelegateCallback,
} from '@fastify/cors'
import type { FastifyInstance } from 'fastify'

export type TierCorsOrigins = {
  playerOrigins: readonly string[]
  adminOrigins: readonly string[]
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']

/**
 * Player routes: the configured player origins (or any origin with `*`), no credentials, and only
 * the headers the player app sends (bearer token, voice identity/hints). Binary audio metadata is
 * exposed because browsers hide non-safelisted response headers cross-origin.
 */
function playerPolicy(origin: string | undefined, origins: readonly string[]): FastifyCorsOptions {
  return {
    origin: origins.includes('*') ? '*' : origin !== undefined && origins.includes(origin),
    credentials: false,
    methods: METHODS,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-utterance-id',
      'x-language',
      'x-audio-duration-ms',
    ],
    exposedHeaders: ['X-Request-Id', 'X-Message-Id'],
  }
}

/** Admin routes: only the admin origins, with credentials so the session cookie is sent. */
function adminPolicy(origin: string | undefined, origins: readonly string[]): FastifyCorsOptions {
  return {
    origin: origin !== undefined && origins.includes(origin),
    credentials: true,
    methods: METHODS,
    allowedHeaders: ['Content-Type'],
  }
}

/**
 * Chooses the CORS policy from the path, because a preflight request is routed to the CORS
 * plugin's own `OPTIONS *` route and carries no tier. The route-tier matrix guarantees that every
 * `/v1/admin/*` route is admin-tier (the login route sits there so it answers with credentials).
 */
export function registerTierCors(app: FastifyInstance, origins: TierCorsOrigins): void {
  const delegate: FastifyCorsOptionsDelegateCallback = (request, callback) => {
    const origin = request.headers.origin
    callback(
      null,
      request.url.startsWith('/v1/admin/')
        ? adminPolicy(origin, origins.adminOrigins)
        : playerPolicy(origin, origins.playerOrigins),
    )
  }
  void app.register(cors, () => delegate)
}
