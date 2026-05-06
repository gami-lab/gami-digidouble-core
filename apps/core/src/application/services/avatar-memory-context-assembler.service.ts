import type { IAvatarSessionMemoryRepository } from '../ports/IAvatarSessionMemoryRepository.js'
import type { IMessageRepository } from '../ports/IMessageRepository.js'
import type { ISessionMemoryRepository } from '../ports/ISessionMemoryRepository.js'
import type { IUserMemoryFactRepository } from '../ports/IUserMemoryFactRepository.js'
import type {
  LayeredMemorySnapshot,
  ShortTermMemoryExchange,
} from '../../domain/memory/memory.types.js'

const FACT_LIMIT = 10
const SHORT_TERM_EXCHANGE_LIMIT = 2

export class AvatarMemoryContextAssembler {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly sessionMemoryRepository?: ISessionMemoryRepository,
    private readonly avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository,
    private readonly userMemoryFactRepository?: IUserMemoryFactRepository,
  ) {}

  async build(input: {
    conversationId: string
    sessionId: string
    avatarId: string
    userId: string
  }): Promise<LayeredMemorySnapshot | undefined> {
    const [shortTerm, working, longTermFacts] = await Promise.all([
      this.loadShortTermExchanges(input.conversationId),
      this.loadWorkingMemory(input.sessionId, input.avatarId),
      this.loadLongTermFacts(input.userId),
    ])

    const memory: LayeredMemorySnapshot = {
      ...(shortTerm.length > 0
        ? {
            shortTerm: {
              exchangeCount: 2,
              recentExchanges: shortTerm,
            },
          }
        : {}),
      ...(working !== undefined ? { working } : {}),
      ...(longTermFacts.length > 0 ? { longTerm: { facts: longTermFacts } } : {}),
    }

    return Object.keys(memory).length > 0 ? memory : undefined
  }

  private async loadShortTermExchanges(conversationId: string): Promise<ShortTermMemoryExchange[]> {
    try {
      const messages = await this.messageRepository.findByConversationId(conversationId, {
        limit: 20,
      })
      const ordered = messages
        .slice()
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      const exchanges: ShortTermMemoryExchange[] = []
      let pendingUser: string | null = null

      for (const message of ordered) {
        if (message.role === 'user') {
          pendingUser = message.content
          continue
        }
        if (message.role === 'avatar' && pendingUser !== null) {
          exchanges.push({ user: pendingUser, avatar: message.content })
          pendingUser = null
        }
      }

      return exchanges.slice(-SHORT_TERM_EXCHANGE_LIMIT)
    } catch {
      return []
    }
  }

  private async loadWorkingMemory(
    sessionId: string,
    avatarId: string,
  ): Promise<LayeredMemorySnapshot['working'] | undefined> {
    if (this.hasNoWorkingMemoryRepositories()) {
      return undefined
    }
    try {
      const [sessionMemory, avatarMemory] = await Promise.all([
        this.sessionMemoryRepository?.findBySessionId(sessionId) ?? Promise.resolve(null),
        this.avatarSessionMemoryRepository?.findBySessionIdAndAvatarId(sessionId, avatarId) ??
          Promise.resolve(null),
      ])

      const working = this.toWorkingMemorySnapshot(sessionMemory, avatarMemory)

      return Object.keys(working).length > 0 ? working : undefined
    } catch {
      return undefined
    }
  }

  private hasNoWorkingMemoryRepositories(): boolean {
    return (
      this.sessionMemoryRepository === undefined && this.avatarSessionMemoryRepository === undefined
    )
  }

  private toWorkingMemorySnapshot(
    sessionMemory: { summary: string; updatedAt: string } | null,
    avatarMemory: { avatarId: string; summary: string; updatedAt: string } | null,
  ): LayeredMemorySnapshot['working'] {
    return {
      ...(sessionMemory !== null
        ? { session: { summary: sessionMemory.summary, updatedAt: sessionMemory.updatedAt } }
        : {}),
      ...(avatarMemory !== null
        ? {
            avatar: {
              avatarId: avatarMemory.avatarId,
              summary: avatarMemory.summary,
              updatedAt: avatarMemory.updatedAt,
            },
          }
        : {}),
    }
  }

  private async loadLongTermFacts(
    userId: string,
  ): Promise<Array<{ category: string; key: string; value: string }>> {
    if (this.userMemoryFactRepository === undefined) return []
    try {
      const facts = await this.userMemoryFactRepository.findByUserId(userId)
      return facts.slice(0, FACT_LIMIT).map((fact) => ({
        category: fact.category,
        key: fact.key,
        value: fact.value,
      }))
    } catch {
      return []
    }
  }
}
