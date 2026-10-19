import type { FastifyPluginCallback } from 'fastify'
import { ok } from '@gami/shared'
import type {
  ListPublicScenariosResponse,
  PublicScenarioSummary,
  ScenarioSummary,
} from '@gami/shared'
import type { IMediaAssetRepository } from '../../application/ports/IMediaAssetRepository.js'
import type { IScenarioRepository } from '../../application/ports/IScenarioRepository.js'
import { createPublicMediaLookup } from '../../application/services/media/media-asset-projection.js'
import {
  toPublicScenarioPresentation,
  type PublicMediaLookup,
} from '../../application/services/media/public-presentation.js'
import { ListScenariosUseCase } from '../../application/use-cases/list-scenarios/list-scenarios.use-case.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'

export type ScenarioCatalogueRouteOptions = {
  scenarioRepository?: IScenarioRepository
  mediaAssetRepository: IMediaAssetRepository
}

/** Read-only player catalogue of active scenarios. Authoring lives under `/v1/admin/scenarios`. */
export const scenarioCatalogueRoute: FastifyPluginCallback<ScenarioCatalogueRouteOptions> = (
  app,
  options,
) => {
  const listScenariosUseCase = new ListScenariosUseCase(
    options.scenarioRepository ?? new InMemoryScenarioRepository(),
  )
  const lookup = createPublicMediaLookup(options.mediaAssetRepository)

  app.get('/', async (_request, reply) => {
    const output = await listScenariosUseCase.execute({ status: 'active' })
    const scenarios = await Promise.all(
      output.scenarios.map((scenario) => toPublicScenario(scenario, lookup)),
    )
    return await reply.send(ok<ListPublicScenariosResponse>({ scenarios }))
  })
}

async function toPublicScenario(
  scenario: ScenarioSummary,
  lookup: PublicMediaLookup,
): Promise<PublicScenarioSummary> {
  return {
    scenarioId: scenario.scenarioId,
    name: scenario.name,
    ...(scenario.language !== undefined ? { language: scenario.language } : {}),
    ...(scenario.presentation !== undefined
      ? {
          presentation: await toPublicScenarioPresentation(
            scenario.scenarioId,
            scenario.presentation,
            lookup,
          ),
        }
      : {}),
  }
}
