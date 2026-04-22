import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { ILlmAdapter } from '../../ports/ILlmAdapter.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { buildGameMasterSystemPrompt } from '../../../domain/game-master/gm-prompt.service.js'
import { reduceGmState } from '../../../domain/game-master/gm-state-reducer.js'
import type {
  GameMasterInput,
  GameMasterOutput,
  GameMasterState,
} from '../../../domain/game-master/game-master.types.js'
import { evaluateTriggers, type TriggerPolicy } from '../../../domain/game-master/trigger-engine.js'
import type { RunGameMasterInput } from './run-game-master.types.js'

const DEFAULT_GAME_MASTER_STATE: GameMasterState = {
  progression: '',
  topicsCovered: [],
  interactionCount: 0,
}

export class RunGameMasterUseCase {
  constructor(
    private readonly gmStateRepository: IGmStateRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly llm: ILlmAdapter,
    private readonly observability: IObservabilityAdapter,
    private readonly scenarioRepository?: IScenarioRepository,
  ) {}

  async execute(input: RunGameMasterInput): Promise<void> {
    const currentState = await this.loadCurrentState(input.sessionId)
    const scenarioContext = await this.loadScenarioContext(input.scenarioId)
    const triggerReason = evaluateTriggers(currentState, scenarioContext.policy)

    if (triggerReason === null) {
      await this.handleSkippedTurn(input, currentState)
      return
    }

    const gmInput = await this.buildGameMasterInput(input, currentState, scenarioContext)

    const llmStart = Date.now()
    const llmResponse = await this.llm.complete({
      systemPrompt: buildGameMasterSystemPrompt(),
      messages: [{ role: 'user', content: JSON.stringify(gmInput) }],
    })

    const output = safeParseGameMasterOutput(llmResponse.content)
    if (output === null) {
      await this.handleInvalidOutput(input, currentState, triggerReason, llmResponse, llmStart)
      return
    }

    const nextState = reduceGmState(currentState, output.stateUpdate)
    await this.gmStateRepository.save(input.sessionId, nextState)

    if (hasText(output.context?.notes)) {
      await this.sessionRepository.update(input.sessionId, { gmNotes: output.context.notes.trim() })
    }
    // TODO(EPIC-4.1-events): emit gm_triggered event

    if (
      hasText(output.stateUpdate.activeAvatarId) &&
      output.stateUpdate.activeAvatarId.trim() !== currentState.currentAvatarId
    ) {
      await this.sessionRepository.update(input.sessionId, {
        activeAvatarId: output.stateUpdate.activeAvatarId.trim(),
      })
    }

    await this.traceSafe({
      requestId: input.correlationId,
      sessionId: input.sessionId,
      event: 'gm.triggered',
      input: {
        triggerReason,
        turnIndex: input.turnIndex,
      },
      output,
      latencyMs: Date.now() - llmStart,
      inputTokens: llmResponse.inputTokens,
      outputTokens: llmResponse.outputTokens,
      metadata: { model: llmResponse.model },
    })
  }

  private async loadCurrentState(sessionId: string): Promise<GameMasterState> {
    return (
      (await this.gmStateRepository.findBySessionId(sessionId)) ?? { ...DEFAULT_GAME_MASTER_STATE }
    )
  }

  private async buildGameMasterInput(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    scenarioContext: {
      description?: string
      goals?: string[]
      policy?: TriggerPolicy
    },
  ): Promise<GameMasterInput> {
    const availableAvatars = await this.avatarRepository.listByScenarioId(input.scenarioId)

    return {
      session: { sessionId: input.sessionId, turnIndex: input.turnIndex },
      userMessage: { text: input.userMessageText },
      state: currentState,
      context: {
        experience: {
          scenarioId: input.scenarioId,
          ...(scenarioContext.description !== undefined
            ? { description: scenarioContext.description }
            : {}),
          ...(scenarioContext.goals !== undefined ? { goals: scenarioContext.goals } : {}),
        },
        availableAvatars: availableAvatars.map((avatar) => ({
          avatarId: avatar.avatarId,
          name: avatar.name,
          ...(avatar.description !== undefined ? { description: avatar.description } : {}),
        })),
        ...(scenarioContext.policy !== undefined ? { policy: scenarioContext.policy } : {}),
      },
    }
  }

  private async handleSkippedTurn(
    input: RunGameMasterInput,
    currentState: GameMasterState,
  ): Promise<void> {
    await this.incrementInteractionAndSave(input.sessionId, currentState)
    // TODO(EPIC-4.1-events): emit gm_skipped event
    await this.traceSafe({
      requestId: input.correlationId,
      sessionId: input.sessionId,
      event: 'gm.skipped',
      input: {
        triggerReason: null,
        turnIndex: input.turnIndex,
      },
    })
  }

  private async handleInvalidOutput(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    triggerReason: string,
    llmResponse: {
      content: string
      model: string
      inputTokens: number
      outputTokens: number
    },
    llmStart: number,
  ): Promise<void> {
    await this.incrementInteractionAndSave(input.sessionId, currentState)
    // TODO(EPIC-4.1-events): emit gm_skipped event
    await this.traceSafe({
      requestId: input.correlationId,
      sessionId: input.sessionId,
      event: 'gm.invalid_output',
      input: { triggerReason },
      output: llmResponse.content,
      latencyMs: Date.now() - llmStart,
      inputTokens: llmResponse.inputTokens,
      outputTokens: llmResponse.outputTokens,
      metadata: { model: llmResponse.model },
    })
  }

  private incrementInteractionAndSave(
    sessionId: string,
    currentState: GameMasterState,
  ): Promise<void> {
    return this.gmStateRepository.save(sessionId, {
      ...currentState,
      interactionCount: currentState.interactionCount + 1,
    })
  }

  private async traceSafe(event: {
    requestId: string
    sessionId: string
    event: string
    input?: unknown
    output?: unknown
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
    metadata?: Record<string, unknown>
  }): Promise<void> {
    try {
      await this.observability.trace(event)
    } catch (err: unknown) {
      console.error('[GM] Observability trace failed for event:', event.event, err)
    }
  }

  private async loadScenarioContext(scenarioId: string): Promise<{
    description?: string
    goals?: string[]
    policy?: TriggerPolicy
  }> {
    if (this.scenarioRepository === undefined) {
      return {}
    }
    const scenario = await this.scenarioRepository.findById(scenarioId)
    if (scenario === null) {
      return {}
    }
    return {
      ...(hasText(scenario.config.worldContext)
        ? { description: scenario.config.worldContext }
        : {}),
      ...(Array.isArray(scenario.config.objectives) ? { goals: scenario.config.objectives } : {}),
      ...extractScenarioPolicy(scenario.config),
    }
  }
}

function safeParseGameMasterOutput(content: string): GameMasterOutput | null {
  try {
    const parsed: unknown = JSON.parse(content)
    const output = toGameMasterOutput(parsed)
    if (output !== null) {
      return output
    }
  } catch (parseError) {
    console.error('[GM] Failed to parse Game Master output JSON:', content, parseError)
    return null
  }

  console.error(
    '[GM] Invalid Game Master output shape: missing required fields or incorrect types.',
  )
  return null
}

function toGameMasterOutput(value: unknown): GameMasterOutput | null {
  if (!isRecord(value)) return null
  const avatarId = value['avatarId']
  if (!hasText(avatarId)) return null
  if (!isConversationMode(value['conversationMode'])) return null

  const stateUpdate = toStateUpdate(value['stateUpdate'])
  if (stateUpdate === null) return null

  const context = value['context']
  const notes = isRecord(context) && hasText(context['notes']) ? context['notes'].trim() : undefined

  return {
    avatarId: avatarId.trim(),
    conversationMode: value['conversationMode'],
    ...(notes !== undefined ? { context: { notes } } : {}),
    stateUpdate,
  }
}

function toStateUpdate(value: unknown): GameMasterOutput['stateUpdate'] | null {
  if (!isRecord(value)) return null
  if (value['interactionIncrement'] !== 1) return null
  if (!isValidProgression(value['progression'])) return null
  const topicCovered = hasText(value['topicCovered']) ? value['topicCovered'].trim() : undefined
  const activeAvatarId = hasText(value['activeAvatarId'])
    ? value['activeAvatarId'].trim()
    : undefined

  return {
    interactionIncrement: 1,
    ...(value['progression'] !== undefined ? { progression: value['progression'] } : {}),
    ...(topicCovered !== undefined ? { topicCovered } : {}),
    ...(activeAvatarId !== undefined ? { activeAvatarId } : {}),
  }
}

function isValidProgression(value: unknown): value is 'none' | 'increase' | undefined {
  return value === undefined || value === 'none' || value === 'increase'
}

function isConversationMode(value: unknown): value is 'new' | 'continue' {
  return value === 'new' || value === 'continue'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function extractScenarioPolicy(config: unknown): { policy?: TriggerPolicy } {
  if (!isRecord(config)) {
    return {}
  }
  const policyRaw = config['policy']
  if (typeof policyRaw !== 'object' || policyRaw === null) {
    return {}
  }

  const policyCandidate = policyRaw as Record<string, unknown>
  const turnThreshold = toValidPositiveInteger(policyCandidate['turnThreshold'])
  const maxTopicRepeatCount = toValidPositiveInteger(policyCandidate['maxTopicRepeatCount'])
  const maxTurnsWithoutProgression = toValidPositiveInteger(
    policyCandidate['maxTurnsWithoutProgression'],
  )
  const policy: TriggerPolicy = {
    ...(turnThreshold !== undefined ? { turnThreshold } : {}),
    ...(maxTopicRepeatCount !== undefined ? { maxTopicRepeatCount } : {}),
    ...(maxTurnsWithoutProgression !== undefined ? { maxTurnsWithoutProgression } : {}),
  }

  return Object.keys(policy).length > 0 ? { policy } : {}
}

function toValidPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined
  }
  return value
}
