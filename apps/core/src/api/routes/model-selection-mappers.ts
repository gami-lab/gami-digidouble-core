import {
  SCENARIO_MODEL_SLOTS,
  type CreateAvatarRequest,
  type CreateScenarioRequest,
  type ScenarioModelSelection,
  type UpdateScenarioRequest,
} from '@gami/shared'
import type { CreateAvatarInput } from '../../application/use-cases/create-avatar/create-avatar.types.js'
import type { CreateScenarioInput } from '../../application/use-cases/create-scenario/create-scenario.types.js'
import type { UpdateScenarioInput } from '../../application/use-cases/update-scenario/update-scenario.types.js'

export function mapCreateScenarioInput(body: CreateScenarioRequest): CreateScenarioInput {
  const normalizedModelSelection = normalizeCreateScenarioModelSelection(body.modelSelection)
  return {
    name: body.name,
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.language !== undefined ? { language: body.language } : {}),
    ...(body.objectives !== undefined ? { objectives: body.objectives } : {}),
    ...(body.worldContext !== undefined ? { worldContext: body.worldContext } : {}),
    ...(body.avatarAvailability !== undefined
      ? { avatarAvailability: body.avatarAvailability }
      : {}),
    ...(normalizedModelSelection !== undefined ? { modelSelection: normalizedModelSelection } : {}),
    ...(body.voiceConfig !== undefined ? { voiceConfig: body.voiceConfig } : {}),
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
    ...mapUpdateScenarioFields(body),
  }

  if (normalizedModelSelection !== undefined) {
    input.modelSelection = normalizedModelSelection
  } else if (body.modelSelection === null) {
    input.modelSelection = null
  }

  return input
}

function mapUpdateScenarioFields(
  body: UpdateScenarioRequest,
): Omit<UpdateScenarioInput, 'scenarioId' | 'modelSelection'> {
  return {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.language !== undefined ? { language: body.language } : {}),
    ...(body.objectives !== undefined ? { objectives: body.objectives } : {}),
    ...(body.worldContext !== undefined ? { worldContext: body.worldContext } : {}),
    ...(body.avatarAvailability !== undefined
      ? { avatarAvailability: body.avatarAvailability }
      : {}),
    ...(body.voiceConfig !== undefined ? { voiceConfig: body.voiceConfig } : {}),
    ...(body.config !== undefined ? { config: body.config } : {}),
  }
}

export function mapCreateAvatarInput(
  scenarioId: string,
  body: CreateAvatarRequest,
): CreateAvatarInput {
  const normalizedLlmOverride = normalizeAvatarLlmOverride(body.llmOverride)
  return {
    scenarioId,
    name: body.name,
    personaPrompt: body.personaPrompt,
    ...(body.tone !== undefined ? { tone: body.tone } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.adjustments !== undefined ? { adjustments: body.adjustments } : {}),
    ...(normalizedLlmOverride !== undefined ? { llmOverride: normalizedLlmOverride } : {}),
    ...(body.voiceConfig !== undefined ? { voiceConfig: body.voiceConfig } : {}),
    ...(body.config !== undefined ? { config: body.config } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  }
}

export function normalizeAvatarLlmOverride(
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

  const normalized: ScenarioModelSelection = {}
  for (const slot of SCENARIO_MODEL_SLOTS) {
    const profile = modelSelection[slot]
    if (profile !== undefined) {
      normalized[slot] = { provider: profile.provider, model: profile.model.trim() }
    }
  }
  return normalized
}

function normalizeUpdateScenarioModelSelection(
  modelSelection: UpdateScenarioRequest['modelSelection'],
): UpdateScenarioInput['modelSelection'] {
  if (modelSelection === undefined || modelSelection === null) return modelSelection
  return normalizeCreateScenarioModelSelection(modelSelection)
}
