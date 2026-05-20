import type { ILlmAdapter } from '../ports/ILlmAdapter.js'
import type { IModelConfigRepository } from '../ports/IModelConfigRepository.js'
import {
  DEFAULT_MODEL_CONFIG,
  ModelResolutionService,
  type AvatarLlmOverride,
  type ModelConfig,
  type ModelRole,
} from '../../domain/model-config/index.js'
import type { LlmAdapterRegistry } from '../../infrastructure/llm/llm-adapter-registry.js'

export async function resolveRoleLlmCall(args: {
  role: ModelRole
  legacyAdapter: ILlmAdapter
  modelConfigRepository: IModelConfigRepository | undefined
  llmAdapterRegistry: LlmAdapterRegistry | undefined
  modelConfigFallback: ModelConfig | undefined
  avatarOverride: AvatarLlmOverride | undefined
}): Promise<{ adapter: ILlmAdapter; provider: string; model?: string; effectiveModel: string }> {
  if (args.modelConfigRepository === undefined || args.llmAdapterRegistry === undefined) {
    return { adapter: args.legacyAdapter, provider: 'legacy', effectiveModel: 'legacy' }
  }

  const config =
    (await args.modelConfigRepository.get()) ?? args.modelConfigFallback ?? DEFAULT_MODEL_CONFIG
  const resolved = ModelResolutionService.resolve(args.role, config, args.avatarOverride)
  const normalizedModel = resolved.model.trim().length > 0 ? resolved.model.trim() : undefined

  return {
    adapter: args.llmAdapterRegistry.get(resolved.provider),
    provider: resolved.provider,
    ...(normalizedModel !== undefined ? { model: normalizedModel } : {}),
    effectiveModel: normalizedModel ?? 'adapter_default',
  }
}

export function logResolvedLlmCall(args: {
  role: ModelRole
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
