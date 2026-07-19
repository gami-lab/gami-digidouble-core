import crypto from 'node:crypto'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import type { ILlmAdapter } from '../../ports/ILlmAdapter.js'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import type { ModelConfig } from '../../../domain/model-config/index.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { LlmAdapterRegistry } from '../../../infrastructure/llm/llm-adapter-registry.js'
import { LlmError } from '../../../infrastructure/llm/llm.error.js'
import {
  logResolvedLlmCall,
  resolveRoleLlmCall,
} from '../../services/model-resolution-runtime.service.js'
import {
  normalizeComputedTraits,
  parseTraitPreparationOutput,
} from './prepare-scenario-avatar-traits.parsing.js'
import {
  buildTraitPreparationUserMessage,
  TRAIT_PREPARATION_SYSTEM_PROMPT,
} from './prepare-scenario-avatar-traits.prompt.js'
import type {
  AvatarTraitPreparationFailureReason,
  AvatarTraitPreparationResult,
  PrepareScenarioAvatarTraitsInput,
  PrepareScenarioAvatarTraitsOutput,
} from './prepare-scenario-avatar-traits.types.js'

const TRAIT_PREPARATION_MAX_TOKENS = 700

/**
 * Computes and persists structured avatar traits for every avatar in a
 * scenario (EPIC 8.1). This is an explicit, rerunnable preparation step —
 * not runtime prompt assembly (that's EPIC 8.2) — that derives stable data
 * from existing authored inputs and overwrites `computedTraits` only.
 */
export class PrepareScenarioAvatarTraitsUseCase {
  constructor(
    private readonly scenarioRepository: IScenarioRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly knowledgeSourceRepository: IKnowledgeSourceRepository,
    private readonly llm: ILlmAdapter,
    private readonly modelConfigRepository?: IModelConfigRepository,
    private readonly llmAdapterRegistry?: LlmAdapterRegistry,
    private readonly modelConfigFallback?: ModelConfig,
    private readonly observability?: IObservabilityAdapter,
  ) {}

  async execute(
    input: PrepareScenarioAvatarTraitsInput,
  ): Promise<PrepareScenarioAvatarTraitsOutput> {
    const scenario = await this.scenarioRepository.findById(input.scenarioId)
    if (scenario === null) {
      throw new DomainError('NOT_FOUND', `Scenario ${input.scenarioId} was not found.`)
    }

    const avatars = await this.avatarRepository.listByScenarioId(input.scenarioId)
    const { memorySources, worldSources } = await this.gatherSupportingDocuments(input.scenarioId)

    const results: AvatarTraitPreparationResult[] = []
    for (const avatar of avatars) {
      results.push(await this.prepareOneAvatar({ avatar, scenario, memorySources, worldSources }))
    }

    await this.tracePreparationSummary(scenario.scenarioId, results)

    return { scenarioId: scenario.scenarioId, results }
  }

  private async gatherSupportingDocuments(
    scenarioId: string,
  ): Promise<{ memorySources: KnowledgeSource[]; worldSources: KnowledgeSource[] }> {
    const [memorySources, worldSources] = await Promise.all([
      this.knowledgeSourceRepository.listByScenario({ scenarioId, knowledgeType: 'memory' }),
      this.knowledgeSourceRepository.listByScenario({ scenarioId, knowledgeType: 'world' }),
    ])
    return { memorySources, worldSources }
  }

  private async prepareOneAvatar(args: {
    avatar: AvatarConfig
    scenario: Scenario
    memorySources: KnowledgeSource[]
    worldSources: KnowledgeSource[]
  }): Promise<AvatarTraitPreparationResult> {
    let response: Awaited<ReturnType<ILlmAdapter['complete']>>
    try {
      response = await this.callTraitPreparationLlm(args)
    } catch (error) {
      return buildFailedResult(args.avatar.avatarId, classifyLlmFailure(error))
    }

    const parsed = parseTraitPreparationOutput(response.content)
    if (parsed === null) {
      return buildFailedResult(args.avatar.avatarId, 'unparseable_output')
    }

    const normalized = normalizeComputedTraits(parsed)
    try {
      await this.avatarRepository.saveComputedTraits(args.avatar.avatarId, normalized)
    } catch {
      return buildFailedResult(args.avatar.avatarId, 'persistence_error')
    }

    return { avatarId: args.avatar.avatarId, status: 'prepared', computedTraits: normalized }
  }

  private async callTraitPreparationLlm(args: {
    avatar: AvatarConfig
    scenario: Scenario
    memorySources: KnowledgeSource[]
    worldSources: KnowledgeSource[]
  }): ReturnType<ILlmAdapter['complete']> {
    const resolvedLlm = await resolveRoleLlmCall({
      role: 'avatar',
      legacyAdapter: this.llm,
      modelConfigRepository: this.modelConfigRepository,
      llmAdapterRegistry: this.llmAdapterRegistry,
      modelConfigFallback: this.modelConfigFallback,
      avatarOverride: args.avatar.llmOverride,
      scenarioModelSelection: args.scenario.modelSelection,
    })
    logResolvedLlmCall({
      role: 'avatar',
      effectiveProvider: resolvedLlm.provider,
      effectiveModel: resolvedLlm.effectiveModel,
    })

    return await resolvedLlm.adapter.complete({
      systemPrompt: TRAIT_PREPARATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildTraitPreparationUserMessage(args) }],
      ...(resolvedLlm.model !== undefined ? { model: resolvedLlm.model } : {}),
      maxTokens: TRAIT_PREPARATION_MAX_TOKENS,
      trace: {
        requestId: crypto.randomUUID(),
        event: 'avatar.trait_preparation',
        errorEvent: 'avatar.trait_preparation.llm_error',
        metadata: {
          scenarioId: args.scenario.scenarioId,
          avatarId: args.avatar.avatarId,
          effectiveProvider: resolvedLlm.provider,
          effectiveModel: resolvedLlm.effectiveModel,
        },
      },
    })
  }

  private async tracePreparationSummary(
    scenarioId: string,
    results: AvatarTraitPreparationResult[],
  ): Promise<void> {
    if (this.observability === undefined) return

    const preparedResults = results.filter(
      (result): result is Extract<AvatarTraitPreparationResult, { status: 'prepared' }> =>
        result.status === 'prepared',
    )
    const failedResults = results.filter((result) => result.status === 'failed')

    try {
      await this.observability.trace({
        requestId: crypto.randomUUID(),
        event: 'avatar.trait_preparation.completed',
        output: {
          preparedCount: preparedResults.length,
          failedCount: failedResults.length,
        },
        metadata: {
          scenarioId,
          avatarCount: results.length,
          preparedAvatarIds: preparedResults.map((result) => result.avatarId),
          failedAvatarIds: failedResults.map((result) => result.avatarId),
          failureReasons: [...new Set(failedResults.map((result) => result.reason))],
        },
      })
    } catch (error) {
      console.error('[avatar.trait_preparation] Failed to record summary trace', error)
    }
  }
}

function buildFailedResult(
  avatarId: string,
  reason: AvatarTraitPreparationFailureReason,
): AvatarTraitPreparationResult {
  return { avatarId, status: 'failed', reason }
}

function classifyLlmFailure(error: unknown): AvatarTraitPreparationFailureReason {
  if (error instanceof LlmError) return 'llm_error'
  if (error instanceof Error) return 'llm_error'
  return 'unknown_error'
}
