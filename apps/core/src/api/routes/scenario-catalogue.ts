import type { FastifyPluginCallback } from 'fastify'
import { ok } from '@gami/shared'
import type {
  ListPublicScenariosResponse,
  PublicScenarioSummary,
  ScenarioSummary,
} from '@gami/shared'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import { ListScenariosUseCase } from '../../application/use-cases/list-scenarios/list-scenarios.use-case.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'

export type ScenarioCatalogueRouteOptions = {
  scenarioRepository?: IScenarioRepository
}

/** Read-only player catalogue of active scenarios. Authoring lives under `/v1/admin/scenarios`. */
export const scenarioCatalogueRoute: FastifyPluginCallback<ScenarioCatalogueRouteOptions> = (
  app,
  options,
) => {
  const listScenariosUseCase = new ListScenariosUseCase(
    options.scenarioRepository ?? new InMemoryScenarioRepository(),
  )

  app.get('/', async (_request, reply) => {
    const output = await listScenariosUseCase.execute({ status: 'active' })
    return await reply.send(
      ok<ListPublicScenariosResponse>({ scenarios: output.scenarios.map(toPublicScenario) }),
    )
  })
}

function toPublicScenario(scenario: ScenarioSummary): PublicScenarioSummary {
  return {
    scenarioId: scenario.scenarioId,
    name: scenario.name,
    ...(scenario.language !== undefined ? { language: scenario.language } : {}),
    ...(scenario.presentation !== undefined ? { presentation: scenario.presentation } : {}),
  }
}
