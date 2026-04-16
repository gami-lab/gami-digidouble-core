import type { FastifyPluginAsync } from 'fastify'
import { ok } from '@gami/shared'

type HealthData = {
  status: 'ok'
  version: string
  timestamp: string
}

export const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_request, reply) => {
    return reply.send(
      ok<HealthData>({
        status: 'ok',
        version: process.env['npm_package_version'] ?? '0.0.0',
        timestamp: new Date().toISOString(),
      }),
    )
  })
}
