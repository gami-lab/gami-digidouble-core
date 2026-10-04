import type { ILlmAdapter } from '../ports/ILlmAdapter.js'
import type { IModelConfigRepository } from '../ports/IModelConfigRepository.js'
import {
  DEFAULT_MODEL_CONFIG,
  ModelResolutionService,
  type AvatarLlmOverride,
  type ModelConfig,
  type ModelRole,
  type ProviderName,
  type ScenarioModelSelectionConfig,
} from '../../domain/model-config/index.js'
import type { ModelSelectionOverride } from '@gami/shared'
import type { LlmAdapterRegistry } from '../../infrastructure/llm/llm-adapter-registry.js'
import { LlmError } from '../../infrastructure/llm/llm.error.js'

/** What an LLM call is for: a runtime role, or one-time trait preparation (not tied to a role). */
export type LlmCallPurpose = ModelRole | 'traitPreparation'

type ResolvedLlmCall = {
  adapter: ILlmAdapter
  provider: string
  model?: string
  serviceTier?: 'fast'
  effectiveModel: string
}

function resolveAdapterOrThrow(
  llmAdapterRegistry: LlmAdapterRegistry,
  provider: ProviderName,
  purpose: LlmCallPurpose,
): ILlmAdapter {
  try {
    return llmAdapterRegistry.get(provider)
  } catch (error) {
    if (error instanceof LlmError && error.statusCode === 503) {
      throw new LlmError(
        provider,
        `Provider '${provider}' is configured for '${purpose}' but no API key is available.`,
        503,
      )
    }
    throw error
  }
}

async function resolveLlmCall(args: {
  purpose: LlmCallPurpose
  defaultAdapter: ILlmAdapter
  modelConfigRepository: IModelConfigRepository | undefined
  llmAdapterRegistry: LlmAdapterRegistry | undefined
  modelConfigFallback: ModelConfig | undefined
  select: (config: ModelConfig) => { provider: ProviderName; model: string; serviceTier?: 'fast' }
}): Promise<ResolvedLlmCall> {
  if (args.modelConfigRepository === undefined || args.llmAdapterRegistry === undefined) {
    return { adapter: args.defaultAdapter, provider: 'null', effectiveModel: 'adapter_default' }
  }

  const config =
    (await args.modelConfigRepository.get()) ?? args.modelConfigFallback ?? DEFAULT_MODEL_CONFIG
  const resolved = args.select(config)
  const normalizedModel = resolved.model.trim().length > 0 ? resolved.model.trim() : undefined

  return {
    adapter: resolveAdapterOrThrow(args.llmAdapterRegistry, resolved.provider, args.purpose),
    provider: resolved.provider,
    ...(normalizedModel !== undefined ? { model: normalizedModel } : {}),
    ...(resolved.serviceTier === undefined ? {} : { serviceTier: resolved.serviceTier }),
    effectiveModel: normalizedModel ?? 'adapter_default',
  }
}

export async function resolveRoleLlmCall(args: {
  role: ModelRole
  defaultAdapter: ILlmAdapter
  modelConfigRepository: IModelConfigRepository | undefined
  llmAdapterRegistry: LlmAdapterRegistry | undefined
  modelConfigFallback: ModelConfig | undefined
  avatarOverride: AvatarLlmOverride | undefined
  requestOverride?: AvatarLlmOverride
  sessionOverride?: ModelSelectionOverride
  scenarioModelSelection: ScenarioModelSelectionConfig | undefined
}): Promise<ResolvedLlmCall> {
  return await resolveLlmCall({
    ...args,
    purpose: args.role,
    select: (config) =>
      ModelResolutionService.resolve(args.role, config, {
        ...(args.avatarOverride !== undefined ? { avatarOverride: args.avatarOverride } : {}),
        ...(args.requestOverride !== undefined ? { requestOverride: args.requestOverride } : {}),
        ...(args.sessionOverride !== undefined ? { sessionOverride: args.sessionOverride } : {}),
        ...(args.scenarioModelSelection !== undefined
          ? { scenarioModelSelection: args.scenarioModelSelection }
          : {}),
      }),
  })
}

/** Trait preparation: scenario default -> global default, ignoring every role/avatar override. */
export async function resolveTraitPreparationLlmCall(args: {
  defaultAdapter: ILlmAdapter
  modelConfigRepository: IModelConfigRepository | undefined
  llmAdapterRegistry: LlmAdapterRegistry | undefined
  modelConfigFallback: ModelConfig | undefined
  scenarioModelSelection: ScenarioModelSelectionConfig | undefined
}): Promise<ResolvedLlmCall> {
  return await resolveLlmCall({
    ...args,
    purpose: 'traitPreparation',
    select: (config) =>
      ModelResolutionService.resolveScenarioOrGlobalDefault(config, args.scenarioModelSelection),
  })
}

export function logResolvedLlmCall(args: {
  role: LlmCallPurpose
  effectiveProvider: string
  effectiveModel: string
}): void {
  if (process.env['NODE_ENV'] === 'test') return

  console.debug('[llm.resolve]', {
    role: args.role,
    effectiveProvider: args.effectiveProvider,
    effectiveModel: args.effectiveModel,
  })
}
