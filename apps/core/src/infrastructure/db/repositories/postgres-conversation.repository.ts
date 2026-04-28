import type { Sql } from 'postgres'
import type {
  ConversationUpdate,
  CreateConversationParams,
  IConversationRepository,
} from '../../../application/ports/IConversationRepository.js'
import type { Conversation } from '../../../domain/conversation/session.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

interface ConversationRow {
  id: string
  session_id: string
  avatar_id: string
  status: string
  started_at: Date
  last_activity_at: Date
  ended_at: Date | null
  started_by: string | null
  reason: string | null
  handoff_from_conversation_id: string | null
}

function rowToConversation(row: ConversationRow): Conversation {
  return {
    conversationId: `conversation_${row.id}`,
    sessionId: `session_${row.session_id}`,
    avatarId: `avatar_${row.avatar_id}`,
    status: row.status as Conversation['status'],
    startedAt: row.started_at.toISOString(),
    lastActivityAt: row.last_activity_at.toISOString(),
    ...(row.ended_at !== null ? { endedAt: row.ended_at.toISOString() } : {}),
    ...(row.started_by !== null
      ? { startedBy: row.started_by as NonNullable<Conversation['startedBy']> }
      : {}),
    ...(row.reason !== null ? { reason: row.reason } : {}),
    ...(row.handoff_from_conversation_id !== null
      ? { handoffFromConversationId: `conversation_${row.handoff_from_conversation_id}` }
      : {}),
  }
}

export class PostgresConversationRepository implements IConversationRepository {
  constructor(private readonly sql: Sql) {}

  async findById(conversationId: string): Promise<Conversation | null> {
    const uuid = extractUuid('conversation_', conversationId)
    if (uuid === null) return null
    const [row] = await this.sql<[ConversationRow?]>`
      SELECT
        id,
        session_id,
        avatar_id,
        status,
        started_at,
        last_activity_at,
        ended_at,
        started_by,
        reason,
        handoff_from_conversation_id
      FROM conversations
      WHERE id = ${uuid}
    `
    return row === undefined ? null : rowToConversation(row)
  }

  async create(params: CreateConversationParams): Promise<Conversation> {
    const sessionUuid = stripPrefix('session_', params.sessionId)
    const avatarUuid = stripPrefix('avatar_', params.avatarId)
    const [row] = await this.sql<[ConversationRow]>`
      INSERT INTO conversations (
        session_id,
        avatar_id,
        status,
        started_by,
        reason,
        handoff_from_conversation_id
      )
      VALUES (
        ${sessionUuid},
        ${avatarUuid},
        'active',
        ${params.startedBy ?? null},
        ${params.reason ?? null},
        ${
          params.handoffFromConversationId === undefined
            ? null
            : stripPrefix('conversation_', params.handoffFromConversationId)
        }
      )
      RETURNING
        id,
        session_id,
        avatar_id,
        status,
        started_at,
        last_activity_at,
        ended_at,
        started_by,
        reason,
        handoff_from_conversation_id
    `
    return rowToConversation(row)
  }

  async findActiveBySessionId(sessionId: string): Promise<Conversation | null> {
    const sessionUuid = extractUuid('session_', sessionId)
    if (sessionUuid === null) return null
    const [row] = await this.sql<[ConversationRow?]>`
      SELECT
        id,
        session_id,
        avatar_id,
        status,
        started_at,
        last_activity_at,
        ended_at,
        started_by,
        reason,
        handoff_from_conversation_id
      FROM conversations
      WHERE session_id = ${sessionUuid}
        AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1
    `
    return row === undefined ? null : rowToConversation(row)
  }

  async listBySessionId(sessionId: string): Promise<Conversation[]> {
    const sessionUuid = extractUuid('session_', sessionId)
    if (sessionUuid === null) return []
    const rows = await this.sql<ConversationRow[]>`
      SELECT
        id,
        session_id,
        avatar_id,
        status,
        started_at,
        last_activity_at,
        ended_at,
        started_by,
        reason,
        handoff_from_conversation_id
      FROM conversations
      WHERE session_id = ${sessionUuid}
      ORDER BY started_at ASC
    `
    return rows.map(rowToConversation)
  }

  async deleteBySessionId(sessionId: string): Promise<number> {
    const sessionUuid = extractUuid('session_', sessionId)
    if (sessionUuid === null) return 0
    const result = await this.sql`
      DELETE FROM conversations
      WHERE session_id = ${sessionUuid}
    `
    return result.count
  }

  async update(conversationId: string, updates: ConversationUpdate): Promise<Conversation> {
    const uuid = extractUuid('conversation_', conversationId)
    if (uuid === null) {
      throw new Error(`Conversation ${conversationId} was not found.`)
    }

    const hasEndedAtUpdate = Object.hasOwn(updates, 'endedAt')
    const endedAtValue = updates.endedAt === undefined ? null : new Date(updates.endedAt)

    const [row] = await this.sql<[ConversationRow?]>`
      UPDATE conversations
      SET
        status = COALESCE(${updates.status ?? null}, status),
        last_activity_at = COALESCE(
          ${updates.lastActivityAt === undefined ? null : new Date(updates.lastActivityAt)}::TIMESTAMPTZ,
          last_activity_at
        ),
        ended_at = CASE
          WHEN ${hasEndedAtUpdate}::BOOLEAN THEN ${endedAtValue}::TIMESTAMPTZ
          ELSE ended_at
        END,
        reason = COALESCE(${updates.reason ?? null}, reason)
      WHERE id = ${uuid}
      RETURNING
        id,
        session_id,
        avatar_id,
        status,
        started_at,
        last_activity_at,
        ended_at,
        started_by,
        reason,
        handoff_from_conversation_id
    `

    if (row === undefined) {
      throw new Error(`Conversation ${conversationId} was not found.`)
    }

    return rowToConversation(row)
  }
}
