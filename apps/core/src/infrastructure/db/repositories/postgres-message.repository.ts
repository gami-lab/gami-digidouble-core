import type { JSONValue, Sql } from 'postgres'
import type {
  FindMessagesOptions,
  IMessageRepository,
  SaveMessageParams,
} from '../../../application/ports/IMessageRepository.js'
import type { Message, MessageMetadata } from '../../../domain/conversation/session.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  created_at: Date
  metadata: MessageMetadata | null
}

function rowToMessage(row: MessageRow): Message {
  return {
    messageId: `msg_${row.id}`,
    conversationId: `conversation_${row.conversation_id}`,
    role: row.role as Message['role'],
    content: row.content,
    createdAt: row.created_at.toISOString(),
    ...(row.metadata !== null ? { metadata: row.metadata } : {}),
  }
}

export class PostgresMessageRepository implements IMessageRepository {
  constructor(private readonly sql: Sql) {}

  async save(params: SaveMessageParams): Promise<Message> {
    const messageUuid = stripPrefix('msg_', params.messageId)
    const conversationUuid = stripPrefix('conversation_', params.conversationId)
    const [row] = await this.sql<[MessageRow]>`
      INSERT INTO messages (id, conversation_id, role, content, created_at, metadata)
      VALUES (
        ${messageUuid},
        ${conversationUuid},
        ${params.role},
        ${params.content},
        ${new Date(params.createdAt)},
        ${params.metadata === undefined ? null : this.sql.json(params.metadata as JSONValue)}
      )
      RETURNING id, conversation_id, role, content, created_at, metadata
    `
    return rowToMessage(row)
  }

  async findByConversationId(
    conversationId: string,
    options?: FindMessagesOptions,
  ): Promise<Message[]> {
    const uuid = extractUuid('conversation_', conversationId)
    if (uuid === null) return []
    const limit = options?.limit

    const rows =
      limit === undefined
        ? await this.sql<MessageRow[]>`
            SELECT id, conversation_id, role, content, created_at, metadata
            FROM messages
            WHERE conversation_id = ${uuid}
            ORDER BY created_at ASC
          `
        : await this.sql<MessageRow[]>`
            SELECT id, conversation_id, role, content, created_at, metadata
            FROM (
              SELECT id, conversation_id, role, content, created_at, metadata
              FROM messages
              WHERE conversation_id = ${uuid}
              ORDER BY created_at DESC
              LIMIT ${limit}
            ) AS recent_messages
            ORDER BY created_at ASC
          `

    return rows.map(rowToMessage)
  }

  async deleteByConversationId(conversationId: string): Promise<number> {
    const uuid = extractUuid('conversation_', conversationId)
    if (uuid === null) return 0
    const result = await this.sql`
      DELETE FROM messages
      WHERE conversation_id = ${uuid}
    `
    return result.count
  }
}
