import type {
  CreateScenarioResponse,
  GetScenarioResponse,
  UpdateScenarioResponse,
} from '@gami/shared'
import type { CreateScenarioOutput } from '../../application/use-cases/create-scenario/create-scenario.types.js'
import type { GetScenarioOutput } from '../../application/use-cases/get-scenario/get-scenario.types.js'
import type { UpdateScenarioOutput } from '../../application/use-cases/update-scenario/update-scenario.types.js'
import { toScenarioSummary } from '../../application/use-cases/shared/scenario-summary.js'

export function mapCreateScenarioResponse(output: CreateScenarioOutput): CreateScenarioResponse {
  return { scenario: output.scenario }
}

export function mapGetScenarioResponse(output: GetScenarioOutput): GetScenarioResponse {
  return { scenario: toScenarioSummary(output.scenario) }
}

export function mapUpdateScenarioResponse(output: UpdateScenarioOutput): UpdateScenarioResponse {
  return { scenario: toScenarioSummary(output.scenario) }
}
