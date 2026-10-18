import type { FastifyPluginCallback } from 'fastify'
import { fail, ok } from '@gami/shared'
import type {
  AdminLoginRequest,
  AdminLoginResponse,
  AdminLogoutResponse,
  AdminMeResponse,
} from '@gami/shared'
import type { AdminAuthService } from '../../application/auth/admin-auth.service.js'
import { serializeAdminSessionCookie } from '../hooks/admin-credentials.js'

export type AdminAuthRouteOptions = {
  authService: AdminAuthService
}

const loginBodySchema = {
  type: 'object',
  required: ['password'],
  properties: {
    password: { type: 'string', minLength: 1, maxLength: 1024 },
  },
  additionalProperties: false,
} as const

export const adminAuthRoute: FastifyPluginCallback<AdminAuthRouteOptions> = (app, options) => {
  const { authService } = options

  app.post<{ Body: AdminLoginRequest }>(
    '/auth/login',
    { config: { tier: 'open', rateLimit: 'adminLogin' }, schema: { body: loginBodySchema } },
    async (request, reply) => {
      const signIn = await authService.signIn(request.body.password)
      if (signIn === null) {
        request.log.warn({ event: 'admin_auth.login_failed' }, 'Admin sign-in rejected')
        return await reply.status(401).send(fail('UNAUTHORIZED', 'Invalid credentials'))
      }

      request.log.info({ event: 'admin_auth.login_succeeded' }, 'Admin signed in')
      reply.header(
        'Set-Cookie',
        serializeAdminSessionCookie(signIn.sessionId, authService.sessionTtlSeconds),
      )
      return await reply.send(ok<AdminLoginResponse>({ expiresAt: signIn.expiresAt }))
    },
  )

  app.post('/auth/logout', async (request, reply) => {
    if (request.auth?.tier === 'admin' && request.auth.sessionId !== undefined) {
      await authService.signOut(request.auth.sessionId)
      request.log.info({ event: 'admin_auth.logout' }, 'Admin signed out')
    }
    reply.header('Set-Cookie', serializeAdminSessionCookie('', 0))
    return await reply.send(ok<AdminLogoutResponse>({ signedOut: true }))
  })

  app.get('/auth/me', async (request, reply) => {
    if (request.auth?.tier !== 'admin') {
      return await reply.status(401).send(fail('UNAUTHORIZED', 'Missing or invalid credentials'))
    }
    return await reply.send(ok<AdminMeResponse>({ authenticatedBy: request.auth.method }))
  })
}
