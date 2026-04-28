import type {
  ConversationUpdate,
  CreateConversationParams,
  IConversationRepository,
} from '../../application/ports/IConversationRepository.js'
import type { Conversation } from '../../domain/conversation/session.types.js'

export class InMemoryConversationRepository implements IConversationRepository {
  private readonly conversations: Map<string, Conversation>

  constructor(initialData: Conversation[] = []) {
    this.conversations = new Map(
      initialData.map((conversation) => [conversation.conversationId, conversation]),
    )
  }

  findById(conversationId: string): Promise<Conversation | null> {
    return Promise.resolve(this.conversations.get(conversationId) ?? null)
  }

  findActiveBySessionId(sessionId: string): Promise<Conversation | null> {
    const activeConversations = [...this.conversations.values()]
      .filter(
        (conversation) => conversation.sessionId === sessionId && conversation.status === 'active',
      )
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    return Promise.resolve(activeConversations[0] ?? null)
  }

  create(params: CreateConversationParams): Promise<Conversation> {
    const now = new Date().toISOString()
    const conversation: Conversation = {
      conversationId: `conversation_${crypto.randomUUID()}`,
      sessionId: params.sessionId,
      avatarId: params.avatarId,
      status: 'active',
      startedAt: now,
      lastActivityAt: now,
      ...(params.startedBy !== undefined ? { startedBy: params.startedBy } : {}),
      ...(params.reason !== undefined ? { reason: params.reason } : {}),
      ...(params.handoffFromConversationId !== undefined
        ? { handoffFromConversationId: params.handoffFromConversationId }
        : {}),
    }
    this.conversations.set(conversation.conversationId, conversation)
    return Promise.resolve(conversation)
  }

  listBySessionId(sessionId: string): Promise<Conversation[]> {
    return Promise.resolve(
      [...this.conversations.values()]
        .filter((conversation) => conversation.sessionId === sessionId)
        .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)),
    )
  }

  deleteBySessionId(sessionId: string): Promise<number> {
    let count = 0
    for (const [id, conversation] of this.conversations.entries()) {
      if (conversation.sessionId === sessionId) {
        this.conversations.delete(id)
        count += 1
      }
    }
    return Promise.resolve(count)
  }

  update(conversationId: string, updates: ConversationUpdate): Promise<Conversation> {
    const current = this.conversations.get(conversationId)
    if (current === undefined) {
      throw new Error(`Conversation ${conversationId} was not found.`)
    }
    const updated: Conversation = { ...current, ...updates }
    this.conversations.set(conversationId, updated)
    return Promise.resolve(updated)
  }
}
