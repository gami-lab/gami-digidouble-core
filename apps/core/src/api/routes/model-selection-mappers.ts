import type {
  CreateAvatarRequest,
  CreateScenarioRequest,
  UpdateScenarioRequest,
} from '@gami/shared'
import type { CreateAvatarInput } from '../../application/use-cases/create-avatar/create-avatar.types.js'
import type { CreateScenarioInput } from '../../application/use-cases/create-scenario/create-scenario.types.js'
import type { UpdateScenarioInput } from '../../application/use-cases/update-scenario/update-scenario.types.js'

export function mapCreateScenarioInput(body: CreateScenarioRequest): CreateScenarioInput {
  const normalizedModelSelection = normalizeCreateScenarioModelSelection(body.modelSelection)
  return {
    name: body.name,
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.objectives !== undefined ? { objectives: body.objectives } : {}),
    ...(body.worldContext !== undefined ? { worldContext: body.worldContext } : {}),
    ...(body.avatarAvailability !== undefined
      ? { avatarAvailability: body.avatarAvailability }
      : {}),
    ...(normalizedModelSelection !== undefined ? { modelSelection: normalizedModelSelection } : {}),
    ...(body.config !== undefined ? { config: body.config } : {}),
  }
}

export function mapUpdateScenarioInput(
  scenarioId: string,
  body: UpdateScenarioRequest,
): UpdateScenarioInput {
  const normalizedModelSelection = normalizeUpdateScenarioModelSelection(body.modelSelection)
  const input: UpdateScenarioInput = {
    scenarioId,
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.objectives !== undefined ? { objectives: body.objectives } : {}),
    ...(body.worldContext !== undefined ? { worldContext: body.worldContext } : {}),
    ...(body.avatarAvailability !== undefined
      ? { avatarAvailability: body.avatarAvailability }
      : {}),
    ...(body.config !== undefined ? { config: body.config } : {}),
  }

  if (normalizedModelSelection !== undefined) {
    input.modelSelection = normalizedModelSelection
  } else if (body.modelSelection === null) {
    input.modelSelection = null
  }

  return input
}

export function mapCreateAvatarInput(
  scenarioId: string,
  body: CreateAvatarRequest,
): CreateAvatarInput {
  const normalizedLlmOverride = normalizeLlmOverride(body.llmOverride)
  return {
    scenarioId,
    name: body.name,
    personaPrompt: body.personaPrompt,
    ...(body.tone !== undefined ? { tone: body.tone } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.adjustments !== undefined ? { adjustments: body.adjustments } : {}),
    ...(normalizedLlmOverride !== undefined ? { llmOverride: normalizedLlmOverride } : {}),
    ...(body.config !== undefined ? { config: body.config } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  }
}

function normalizeLlmOverride(
  llmOverride: CreateAvatarRequest['llmOverride'],
): CreateAvatarInput['llmOverride'] {
  if (llmOverride === undefined) return undefined
  if (llmOverride === null) return null

  return {
    ...(llmOverride.provider !== undefined ? { provider: llmOverride.provider } : {}),
    ...(llmOverride.model !== undefined ? { model: llmOverride.model.trim() } : {}),
  }
}

function normalizeCreateScenarioModelSelection(
  modelSelection: CreateScenarioRequest['modelSelection'],
): CreateScenarioInput['modelSelection'] {
  if (modelSelection === undefined) return undefined

  return {
    ...(modelSelection.defaultProfile !== undefined
      ? {
          defaultProfile: {
            provider: modelSelection.defaultProfile.provider,
            model: modelSelection.defaultProfile.model.trim(),
          },
        }
      : {}),
    ...(modelSelection.gameMasterOverride !== undefined
      ? {
          gameMasterOverride: {
            provider: modelSelection.gameMasterOverride.provider,
            model: modelSelection.gameMasterOverride.model.trim(),
          },
        }
      : {}),
  }
}

function normalizeUpdateScenarioModelSelection(
  modelSelection: UpdateScenarioRequest['modelSelection'],
): UpdateScenarioInput['modelSelection'] {
  if (modelSelection === undefined || modelSelection === null) return modelSelection
  return normalizeCreateScenarioModelSelection(modelSelection)
}
