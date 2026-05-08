import type { SessionMemoryLayers } from '@gami/shared'
import type { SharedShortTermMemoryExchange } from '@gami/shared'
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
  MEMORY_SHORT_TERM_EXCHANGE_LIMIT,
  MEMORY_SHORT_TERM_MESSAGE_FETCH_LIMIT,
} from '../../../domain/memory/memory.policy.js'
import type {
  GetSessionMemoryLayersInput,
  GetSessionMemoryLayersOutput,
} from './get-session-memory-layers.types.js'

export class GetSessionMemoryLayersUseCase {
  private readonly selectionService?: MemorySelectionService

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

    const [shortTermExchanges, sessionWorkingMemory, avatarMemories, facts] = await Promise.all([
      this.loadShortTermExchanges(session.sessionId),
      this.sessionMemoryRepository?.findBySessionId(session.sessionId) ?? Promise.resolve(null),
      this.avatarSessionMemoryRepository?.listBySessionId(session.sessionId) ?? Promise.resolve([]),
      this.userMemoryFactRepository?.findByUserId(session.userId) ?? Promise.resolve([]),
    ])

    const memory: SessionMemoryLayers = {
      sessionId: session.sessionId,
      shortTerm: {
        exchangeCount: 2,
        recentExchanges: shortTermExchanges,
      },
      working: {
        ...(sessionWorkingMemory !== null
          ? {
              session: {
                summary: sessionWorkingMemory.summary,
                updatedAt: sessionWorkingMemory.updatedAt,
              },
            }
          : {}),
        avatars: avatarMemories.map((memoryRow) => ({
          avatarId: memoryRow.avatarId,
          summary: memoryRow.summary,
          updatedAt: memoryRow.updatedAt,
        })),
      },
      longTerm: {
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

  private async loadShortTermExchanges(
    sessionId: string,
  ): Promise<SharedShortTermMemoryExchange[]> {
    if (this.conversationRepository === undefined || this.messageRepository === undefined) return []
    const conversations = await this.conversationRepository.listBySessionId(sessionId)
    const latest = conversations
      .slice()
      .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt))[0]
    if (latest === undefined) return []

    const messages = await this.messageRepository.findByConversationId(latest.conversationId, {
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

    return exchanges.slice(-MEMORY_SHORT_TERM_EXCHANGE_LIMIT)
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
