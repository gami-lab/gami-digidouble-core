import type { Conversation, Session } from '../../domain/conversation/session.types.js'

/** Port: conversation persistence. Infrastructure must implement this interface. */
export interface IConversationRepository {
  findById(conversationId: string): Promise<Conversation | null>
  create(params: CreateConversationParams): Promise<Conversation>
  listBySessionId(sessionId: string): Promise<Conversation[]>
  update(conversationId: string, updates: ConversationUpdate): Promise<Conversation>
}

export interface CreateConversationParams {
  sessionId: string
  avatarId: string
  startedBy?: Conversation['startedBy']
  reason?: string
  handoffFromConversationId?: string
}

export type ConversationUpdate = Partial<
  Pick<Conversation, 'status' | 'lastActivityAt' | 'endedAt' | 'reason'>
>

export type SessionSummary = Pick<
  Session,
  | 'sessionId'
  | 'userId'
  | 'scenarioId'
  | 'activeAvatarId'
  | 'status'
  | 'startedAt'
  | 'lastActivityAt'
  | 'endedAt'
>
