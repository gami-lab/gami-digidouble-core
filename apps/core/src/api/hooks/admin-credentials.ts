import type { FastifyRequest } from 'fastify'
import { ADMIN_SERVICE_KEY_HEADER } from '@gami/shared'
import type { AdminAuthService } from '../../application/auth/admin-auth.service.js'
import { areSecretsEqual, readHeader, type CredentialVerifier } from './authenticate.js'

export const ADMIN_SESSION_COOKIE = 'gami_admin_session'
const ADMIN_COOKIE_PATH = '/v1/admin'
const SAFE_METHODS = new Set(['GET', 'HEAD'])

export type AdminVerifierOptions = {
  authService: AdminAuthService
  serviceKey: string | undefined
  allowedOrigins: readonly string[]
}

/**
 * Accepts the server-side service key or a signed-in admin session cookie, nothing else.
 * Cookie-authenticated state changes must come from an allowed admin origin (CSRF protection on
 * top of `SameSite=Strict`); service-key requests carry no ambient credential and skip that check.
 */
export function adminVerifier(options: AdminVerifierOptions): CredentialVerifier {
  return async (request) => {
    const serviceKey = readHeader(request.headers[ADMIN_SERVICE_KEY_HEADER])
    if (
      options.serviceKey !== undefined &&
      serviceKey !== undefined &&
      areSecretsEqual(serviceKey, options.serviceKey)
    ) {
      return { outcome: 'authenticated', auth: { tier: 'admin', method: 'service_key' } }
    }

    const sessionId = readAdminSessionCookie(request)
    if (sessionId === undefined || !(await options.authService.isSignedIn(sessionId))) {
      return { outcome: 'unauthenticated' }
    }
    if (!SAFE_METHODS.has(request.method) && !isAllowedOrigin(request, options.allowedOrigins)) {
      return { outcome: 'forbidden', message: 'Request origin is not an allowed admin origin' }
    }
    return { outcome: 'authenticated', auth: { tier: 'admin', method: 'session', sessionId } }
  }
}

export function readAdminSessionCookie(request: FastifyRequest): string | undefined {
  const header = request.headers.cookie
  if (header === undefined) return undefined
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() === ADMIN_SESSION_COOKIE) {
      const value = part.slice(separator + 1).trim()
      return value.length > 0 ? value : undefined
    }
  }
  return undefined
}

export function serializeAdminSessionCookie(sessionId: string, maxAgeSeconds: number): string {
  return [
    `${ADMIN_SESSION_COOKIE}=${sessionId}`,
    `Path=${ADMIN_COOKIE_PATH}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${String(maxAgeSeconds)}`,
  ].join('; ')
}

function isAllowedOrigin(request: FastifyRequest, allowedOrigins: readonly string[]): boolean {
  const origin = request.headers.origin
  return origin !== undefined && allowedOrigins.includes(origin)
}
