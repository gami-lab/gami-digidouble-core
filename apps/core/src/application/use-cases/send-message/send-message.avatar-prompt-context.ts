import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { IUserRepository } from '../../ports/IUserRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../ports/IConversationWorkingMemoryRepository.js'
import type { IConversationMemoryRepository } from '../../ports/IConversationMemoryRepository.js'
import { type AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { buildAvatarAwareness } from '../../../domain/avatar/avatar-awareness.service.js'
import { assemblePersonaPrompt } from '../../../domain/avatar/persona-prompt.service.js'
import { ContextEngine } from '../../../domain/context/context-engine.service.js'
import type { Conversation, Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { UserPersona } from '../../../domain/user/user.types.js'
import { AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS } from '@gami/shared'
import type { SelectedMemoryPayload } from '../../../domain/memory/memory.types.js'
import type { GameMasterOrchestrationState } from '../../../domain/game-master/game-master.types.js'
import { MemorySelectionService } from '../../services/memory-selection.service.js'
import { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import {
  buildAvatarTypedRetrievalQueries,
  flattenTypedRetrievalQueries,
} from '../../services/knowledge/typed-retrieval-query-builder.js'
import { hasSelectedMemoryContent, hasText } from './send-message.helpers.js'
import type { ContextEngineOutput } from '../../../domain/context/context-engine.types.js'
import { toGameMasterAvailableAvatars } from '../run-game-master/run-game-master.avatar-unlocks.js'
import { toScenarioSnapshot } from './send-message.context-engine.js'
import {
  type AvatarRetrievalOutcome,
  buildAvatarContextExtensions,
  buildGmGuidance,
  resolveRetrievalStatus,
} from './send-message.prompt-context.js'
import { optionalField } from '../../../domain/optional-field.js'
import { warnIfContextBudgetTrimmed } from './send-message.context-selection.js'

type AvatarMemorySnapshot = ReturnType<MemorySelectionService['toAvatarMemorySnapshot']>

export type ContextAssembler = {
  assemble(input: Parameters<ContextEngine['assemble']>[0]): ContextEngineOutput
}

export type AvatarPromptContextDeps = {
  avatarRepository: IAvatarRepository
  scenarioRepository: IScenarioRepository
  messageRepository: IMessageRepository
  contextAssembler: ContextAssembler
  userRepository: IUserRepository | undefined
  conversationWorkingMemoryRepository: IConversationWorkingMemoryRepository | undefined
  conversationMemoryRepository: IConversationMemoryRepository | undefined
  memorySelectionService: MemorySelectionService | undefined
  typedRetrievalService: TypedRetrievalService | undefined
}

/** Builds the Avatar system prompt and assembled context for one turn. */
export class AvatarPromptContextBuilder {
  private readonly avatarRepository: IAvatarRepository
  private readonly scenarioRepository: IScenarioRepository
  private readonly messageRepository: IMessageRepository
  private readonly contextAssembler: ContextAssembler
  private readonly userRepository: IUserRepository | undefined
  private readonly conversationWorkingMemoryRepository:
    IConversationWorkingMemoryRepository | undefined
  private readonly conversationMemoryRepository: IConversationMemoryRepository | undefined
  private readonly memorySelectionService: MemorySelectionService | undefined
  private readonly typedRetrievalService: TypedRetrievalService | undefined

  constructor(deps: AvatarPromptContextDeps) {
    this.avatarRepository = deps.avatarRepository
    this.scenarioRepository = deps.scenarioRepository
    this.messageRepository = deps.messageRepository
    this.contextAssembler = deps.contextAssembler
    this.userRepository = deps.userRepository
    this.conversationWorkingMemoryRepository = deps.conversationWorkingMemoryRepository
    this.conversationMemoryRepository = deps.conversationMemoryRepository
    this.memorySelectionService = deps.memorySelectionService
    this.typedRetrievalService = deps.typedRetrievalService
  }

  async build(args: {
    session: Session
    conversation: Conversation
    avatar: AvatarConfig
    userMessage: string
    orchestration: GameMasterOrchestrationState | undefined
  }): Promise<{
    systemPrompt: string
    userPersona: UserPersona | undefined
    selectedMemory?: SelectedMemoryPayload
    orchestration: GameMasterOrchestrationState | undefined
    assembledContext: ContextEngineOutput
    retrievalLatencyMs: number
    scenarioModelSelection: Scenario['modelSelection']
  }> {
    const scenario = await this.loadScenario(args.session.scenarioId)
    const scenarioAvatars = await this.avatarRepository.listByScenarioId(args.session.scenarioId)
    const userPersona = await this.loadUserPersona(args.session.userId)
    const { selectedMemory, memory } = await this.loadTurnMemory(args)
    const directorNotes = args.orchestration?.directorNotes ?? args.session.gmNotes
    const retrievalQueries = buildAvatarTypedRetrievalQueries({
      gmGuideline: directorNotes,
      gmRetrievalQueries: args.orchestration?.retrievalPlan.queries,
      gmRequiredFacts: args.orchestration?.retrievalPlan.requiredFacts,
      lastUserInput: args.userMessage,
      workingMemorySummary: readWorkingMemorySummary(memory),
    })
    const retrievalStartMs = Date.now()
    const retrievalOutcome = await this.loadAvatarRetrieval(
      args.session,
      args.conversation.avatarId,
      retrievalQueries,
    )
    const retrievalStatus = resolveRetrievalStatus(args.orchestration, retrievalOutcome)
    const retrievalLatencyMs = Date.now() - retrievalStartMs
    const assembledContext = this.contextAssembler.assemble({
      sessionId: args.session.sessionId,
      activeAvatarId: args.conversation.avatarId,
      recentMessages: [{ role: 'user', content: args.userMessage }],
      scenario: toScenarioSnapshot(args.session, scenario),
      availableAvatars: toGameMasterAvailableAvatars(scenarioAvatars, args.session),
      gmState: {
        progression: '',
        interactionCount: 0,
      },
      extensions: buildAvatarContextExtensions({
        memory,
        retrieval: retrievalOutcome.retrieval,
        session: args.session,
        avatar: args.avatar,
        userPersona,
        directorNotes,
      }),
    })
    warnIfContextBudgetTrimmed(assembledContext, {
      sessionId: args.session.sessionId,
      conversationId: args.conversation.conversationId,
      avatarId: args.conversation.avatarId,
    })

    const systemPrompt = assemblePersonaPrompt(args.avatar, {
      sections: assembledContext.avatar.sections,
      avatarAwareness: buildAvatarAwareness(
        args.avatar,
        scenarioAvatars,
        args.session.unlockedAvatarIds,
      ),
      ...buildGmGuidance(args.orchestration, directorNotes, retrievalStatus),
    })
    return {
      systemPrompt,
      userPersona,
      assembledContext,
      orchestration: args.orchestration,
      retrievalLatencyMs,
      scenarioModelSelection: scenario.modelSelection,
      ...optionalField('selectedMemory', selectedMemory),
    }
  }

  private async loadTurnMemory(args: {
    session: Session
    conversation: Conversation
    userMessage: string
  }): Promise<{
    selectedMemory: SelectedMemoryPayload | undefined
    memory: AvatarMemorySnapshot | undefined
  }> {
    const selectedMemory = await this.loadSelectedMemory({
      conversationId: args.conversation.conversationId,
      avatarId: args.conversation.avatarId,
      userId: args.session.userId,
      scenarioId: args.session.scenarioId,
      userMessageText: args.userMessage,
    })
    if (selectedMemory === undefined) return { selectedMemory, memory: undefined }
    return {
      selectedMemory,
      memory: this.getMemorySelectionService().toAvatarMemorySnapshot(selectedMemory),
    }
  }

  private async loadAvatarRetrieval(
    session: Session,
    avatarId: string | undefined,
    queries: ReturnType<typeof buildAvatarTypedRetrievalQueries>,
  ): Promise<AvatarRetrievalOutcome> {
    try {
      const retrieval = await this.loadTypedRetrieval(
        session,
        avatarId,
        queries,
        session.avatarOptions?.retrieval,
      )
      return { retrieval, failed: false }
    } catch {
      console.error('[avatar-retrieval] Retrieval failed.')
      return { retrieval: undefined, failed: true }
    }
  }

  private async loadTypedRetrieval(
    session: Session,
    avatarId: string | undefined,
    queries: ReturnType<typeof buildAvatarTypedRetrievalQueries>,
    retrievalOptions: NonNullable<Session['avatarOptions']>['retrieval'] | undefined,
    bypassVisibilityFilter = false,
  ) {
    if (this.typedRetrievalService === undefined) return undefined
    const query = flattenTypedRetrievalQueries(queries)
    if (!hasText(query)) return undefined

    return this.typedRetrievalService.retrieve({
      scenarioId: session.scenarioId,
      ...(avatarId !== undefined ? { activeAvatarId: avatarId } : {}),
      ...(bypassVisibilityFilter ? { bypassVisibilityFilter: true } : {}),
      query,
      queries,
      limitPerType: retrievalOptions?.maxChunks ?? AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS,
    })
  }

  private async loadScenario(scenarioId: string): Promise<Scenario> {
    const scenario = await this.scenarioRepository.findById(scenarioId)
    if (scenario === null) {
      throw new DomainError('NOT_FOUND', `Scenario ${scenarioId} was not found.`)
    }
    return scenario
  }

  private async loadUserPersona(userId: string): Promise<UserPersona | undefined> {
    if (this.userRepository === undefined) return undefined
    try {
      const user = await this.userRepository.findById(userId)
      return user?.persona
    } catch {
      return undefined
    }
  }

  private async loadSelectedMemory(input: {
    conversationId: string
    avatarId: string
    userId: string
    scenarioId: string
    userMessageText: string
  }) {
    try {
      const selected = await this.getMemorySelectionService().select(input)
      return hasSelectedMemoryContent(selected) ? selected : undefined
    } catch {
      return undefined
    }
  }

  private getMemorySelectionService(): MemorySelectionService {
    return (
      this.memorySelectionService ??
      new MemorySelectionService(
        this.messageRepository,
        this.conversationWorkingMemoryRepository,
        this.conversationMemoryRepository,
      )
    )
  }
}

function readWorkingMemorySummary(memory: AvatarMemorySnapshot | undefined): string | undefined {
  return memory?.working?.avatar?.summary ?? memory?.working?.session?.summary
}
