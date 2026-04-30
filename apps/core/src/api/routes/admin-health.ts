import type { FastifyInstance, FastifyPluginCallback } from 'fastify'
import { ok } from '@gami/shared'
import type { IDependencyProbe } from '../../application/ports/IDependencyProbe.js'
import { GetHealthUseCase } from '../../application/use-cases/get-health/get-health.use-case.js'
import type { Config } from '../../config.js'
import type { HealthReport } from '../../domain/health/index.js'
import { authenticateApiKey } from '../hooks/authenticate.js'

export type AdminHealthRouteOptions = {
  config: Config
  probes?: IDependencyProbe[]
}

export const adminHealthRoute: FastifyPluginCallback<AdminHealthRouteOptions> = (app, options) => {
  const getHealthUseCase = new GetHealthUseCase(options.probes ?? [])

  app.addHook('preHandler', authenticateApiKey(options.config.apiKeySecret))
  registerAdminHealthRoute(app, getHealthUseCase)
}

function registerAdminHealthRoute(app: FastifyInstance, useCase: GetHealthUseCase): void {
  app.get('/health', async (_request, reply) => {
    const report = await useCase.execute()
    return await reply.status(200).send(ok<HealthReport>(report))
  })
}
