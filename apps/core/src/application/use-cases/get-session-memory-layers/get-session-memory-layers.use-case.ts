import type { SessionMemoryLayers, SharedShortTermMemoryExchange } from '@gami/shared'
import type { IAvatarSessionMemoryRepository } from '../../ports/IAvatarSessionMemoryRepository.js'
import type { IConversationMemoryRepository } from '../../ports/IConversationMemoryRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../ports/IConversationWorkingMemoryRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { ISessionMemoryRepository } from '../../ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IUserMemoryFactRepository } from '../../ports/IUserMemoryFactRepository.js'
import { MemorySelectionService } from '../../services/memory-selection.service.js'
import { DomainError } from '../../../domain/errors.js'
import {
  ADMIN_LONG_TERM_FACT_DEFAULT_LIMIT,
  MEMORY_SHORT_TERM_MESSAGE_FETCH_LIMIT,
} from '../../../domain/memory/memory.policy.js'
import type { ConversationWorkingMemory } from '../../../domain/memory/memory.types.js'
import type {
  GetSessionMemoryLayersInput,
  GetSessionMemoryLayersOutput,
} from './get-session-memory-layers.types.js'

type LongTermAvatarMemoryGroup = SessionMemoryLayers['longTerm']['avatars'][number]

export class GetSessionMemoryLayersUseCase {
  private readonly selectionService?: MemorySelectionService
  private static readonly ADMIN_SHORT_TERM_EXCHANGE_LIMIT = 3

  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly userMemoryFactRepository?: IUserMemoryFactRepository,
    private readonly sessionMemoryRepository?: ISessionMemoryRepository,
    private readonly avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository,
    private readonly conversationRepository?: IConversationRepository,
    private readonly messageRepository?: IMessageRepository,
    private readonly conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository,
    private readonly conversationMemoryRepository?: IConversationMemoryRepository,
    private readonly eventLogRepository?: IEventLogRepository,
  ) {
    if (
      messageRepository !== undefined &&
      conversationWorkingMemoryRepository !== undefined &&
      conversationMemoryRepository !== undefined
    ) {
      this.selectionService = new MemorySelectionService(
        messageRepository,
        conversationWorkingMemoryRepository,
        conversationMemoryRepository,
        userMemoryFactRepository,
      )
    }
  }

  async execute(input: GetSessionMemoryLayersInput): Promise<GetSessionMemoryLayersOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const activeConversation = await this.loadActiveConversation(session.sessionId)

    const [shortTermExchanges, currentWorkingMemory, facts, longTermAvatarMemories] =
      await Promise.all([
        this.loadShortTermExchanges(activeConversation?.conversationId),
        this.loadCurrentWorkingMemory(activeConversation?.conversationId),
        this.userMemoryFactRepository?.findByUserId(session.userId) ?? Promise.resolve([]),
        this.loadLongTermAvatarMemories(session.sessionId),
      ])

    const workingLayer = this.buildWorkingLayer(currentWorkingMemory)

    const memory: SessionMemoryLayers = {
      sessionId: session.sessionId,
      ...(activeConversation !== null
        ? {
            activeAvatarId: activeConversation.avatarId,
            activeConversationId: activeConversation.conversationId,
          }
        : {}),
      shortTerm: {
        exchangeCount: GetSessionMemoryLayersUseCase.ADMIN_SHORT_TERM_EXCHANGE_LIMIT,
        recentExchanges: shortTermExchanges,
      },
      working: workingLayer,
      longTerm: {
        avatars: longTermAvatarMemories,
        facts: facts.slice(0, ADMIN_LONG_TERM_FACT_DEFAULT_LIMIT).map((fact) => ({
          category: fact.category,
          key: fact.key,
          value: fact.value,
          updatedAt: fact.updatedAt,
        })),
      },
      ...(await this.buildObservability(session)),
    }

    return { memory }
  }

  private buildWorkingLayer(
    currentWorkingMemory: ConversationWorkingMemory | null,
  ): SessionMemoryLayers['working'] {
    if (currentWorkingMemory === null) {
      return { avatars: [] }
    }

    return {
      current: {
        conversationId: currentWorkingMemory.conversationId,
        avatarId: currentWorkingMemory.avatarId,
        summary: currentWorkingMemory.summary,
        unresolvedThreads: currentWorkingMemory.unresolvedThreads,
        candidateFacts: currentWorkingMemory.candidateFacts,
        updatedAt: currentWorkingMemory.updatedAt,
      },
      session: {
        summary: currentWorkingMemory.summary,
        updatedAt: currentWorkingMemory.updatedAt,
      },
      avatars: [
        {
          avatarId: currentWorkingMemory.avatarId,
          summary: currentWorkingMemory.summary,
          updatedAt: currentWorkingMemory.updatedAt,
        },
      ],
    }
  }

  private async loadShortTermExchanges(
    conversationId: string | undefined,
  ): Promise<SharedShortTermMemoryExchange[]> {
    if (conversationId === undefined || this.messageRepository === undefined) return []

    const messages = await this.messageRepository.findByConversationId(conversationId, {
      limit: MEMORY_SHORT_TERM_MESSAGE_FETCH_LIMIT,
    })
    const orderedMessages = messages
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    const exchanges: SharedShortTermMemoryExchange[] = []
    let pendingUserMessage: string | null = null

    for (const message of orderedMessages) {
      if (message.role === 'user') {
        pendingUserMessage = message.content
        continue
      }
      if (message.role === 'avatar' && pendingUserMessage !== null) {
        exchanges.push({ user: pendingUserMessage, avatar: message.content })
        pendingUserMessage = null
      }
    }

    return exchanges.slice(-GetSessionMemoryLayersUseCase.ADMIN_SHORT_TERM_EXCHANGE_LIMIT)
  }

  private async loadCurrentWorkingMemory(
    conversationId: string | undefined,
  ): Promise<ConversationWorkingMemory | null> {
    if (conversationId === undefined || this.conversationWorkingMemoryRepository === undefined) {
      return null
    }

    return this.conversationWorkingMemoryRepository.findByConversationId(conversationId)
  }

  private async loadActiveConversation(sessionId: string) {
    if (this.conversationRepository === undefined) return null
    return this.conversationRepository.findActiveBySessionId(sessionId)
  }

  private async loadLongTermAvatarMemories(sessionId: string) {
    if (
      this.conversationRepository === undefined ||
      this.conversationMemoryRepository === undefined
    ) {
      return []
    }

    const conversationMemoryRepository = this.conversationMemoryRepository
    const conversations = await this.conversationRepository.listBySessionId(sessionId)
    const episodicMemories = await Promise.all(
      conversations.map(async (conversation) => {
        const memory = await conversationMemoryRepository.findByConversationId(
          conversation.conversationId,
        )
        if (memory === null) return null
        return {
          avatarId: conversation.avatarId,
          conversationId: memory.conversationId,
          summary: memory.summary,
          keyDiscoveries: memory.keyDiscoveries,
          unresolvedTopics: memory.unresolvedTopics,
          factCandidates: memory.factCandidates,
          createdAt: memory.createdAt,
        }
      }),
    )

    const grouped = new Map<string, LongTermAvatarMemoryGroup['memories']>()

    for (const memory of episodicMemories) {
      if (memory === null) continue
      const entries = grouped.get(memory.avatarId) ?? []
      entries.push({
        conversationId: memory.conversationId,
        summary: memory.summary,
        keyDiscoveries: memory.keyDiscoveries,
        unresolvedTopics: memory.unresolvedTopics,
        factCandidates: memory.factCandidates,
        createdAt: memory.createdAt,
      })
      grouped.set(memory.avatarId, entries)
    }

    return [...grouped.entries()]
      .map(
        ([avatarId, memories]): LongTermAvatarMemoryGroup => ({
          avatarId,
          memories: memories.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
        }),
      )
      .sort((a: LongTermAvatarMemoryGroup, b: LongTermAvatarMemoryGroup) =>
        a.avatarId.localeCompare(b.avatarId),
      )
  }

  private async buildObservability(session: {
    sessionId: string
    userId: string
    scenarioId: string
  }): Promise<Pick<SessionMemoryLayers, 'observability'> | undefined> {
    const selection = await this.buildSelectionObservability(session)
    const hydration = await this.loadLatestHydrationEvent(session.sessionId)
    if (selection === undefined && hydration === undefined) return undefined
    return {
      observability: {
        ...(selection !== undefined ? { selection } : {}),
        ...(hydration !== undefined ? { hydration } : {}),
      },
    }
  }

  private async buildSelectionObservability(session: {
    sessionId: string
    userId: string
    scenarioId: string
  }) {
    if (
      this.conversationRepository === undefined ||
      this.messageRepository === undefined ||
      this.selectionService === undefined
    ) {
      return undefined
    }
    const conversations = await this.conversationRepository.listBySessionId(session.sessionId)
    const activeConversation = conversations
      .slice()
      .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt))[0]
    if (activeConversation === undefined) return undefined

    const latestMessages = await this.messageRepository.findByConversationId(
      activeConversation.conversationId,
      { limit: 6 },
    )
    const latestUserMessage = latestMessages
      .slice()
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .find((message) => message.role === 'user')?.content
    const selection = await this.selectionService.selectWithObservability({
      conversationId: activeConversation.conversationId,
      userId: session.userId,
      avatarId: activeConversation.avatarId,
      scenarioId: session.scenarioId,
      userMessageText: latestUserMessage ?? '',
    })

    return {
      ...selection.observability,
      evaluatedAt: new Date().toISOString(),
    }
  }

  private async loadLatestHydrationEvent(sessionId: string) {
    if (this.eventLogRepository === undefined) return undefined
    const events = await this.eventLogRepository.findBySessionId(sessionId, { limit: 100 })
    const hydrationEvent = events
      .filter((event) => event.type === 'memory_hydration_succeeded')
      .sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''))[0]
    if (hydrationEvent === undefined) return undefined
    const hydratedConversationId = readString(hydrationEvent.payload['hydratedConversationId'])
    if (hydratedConversationId === undefined) return undefined
    return {
      hydratedConversationId,
      sourceConversationIds: readStringArray(hydrationEvent.payload['sourceConversationIds']),
      hydratedAt: hydrationEvent.createdAt ?? new Date().toISOString(),
    }
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}
