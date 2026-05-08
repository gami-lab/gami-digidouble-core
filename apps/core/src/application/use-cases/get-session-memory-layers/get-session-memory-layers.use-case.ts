import type { SessionMemoryLayers } from '@gami/shared'
import type { SharedShortTermMemoryExchange } from '@gami/shared'
import type { IAvatarSessionMemoryRepository } from '../../ports/IAvatarSessionMemoryRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { ISessionMemoryRepository } from '../../ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IUserMemoryFactRepository } from '../../ports/IUserMemoryFactRepository.js'
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
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly userMemoryFactRepository?: IUserMemoryFactRepository,
    private readonly sessionMemoryRepository?: ISessionMemoryRepository,
    private readonly avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository,
    private readonly conversationRepository?: IConversationRepository,
    private readonly messageRepository?: IMessageRepository,
  ) {}

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
}
