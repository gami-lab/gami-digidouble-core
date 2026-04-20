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
  session_id: string
  role: string
  content: string
  created_at: Date
  metadata: MessageMetadata | null
}

function rowToMessage(row: MessageRow): Message {
  return {
    messageId: `msg_${row.id}`,
    sessionId: `session_${row.session_id}`,
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
    const sessionUuid = stripPrefix('session_', params.sessionId)
    const [row] = await this.sql<[MessageRow]>`
      INSERT INTO messages (id, session_id, role, content, created_at, metadata)
      VALUES (
        ${messageUuid},
        ${sessionUuid},
        ${params.role},
        ${params.content},
        ${new Date(params.createdAt)},
        ${params.metadata === undefined ? null : this.sql.json(params.metadata as JSONValue)}
      )
      RETURNING id, session_id, role, content, created_at, metadata
    `
    return rowToMessage(row)
  }

  async findBySessionId(sessionId: string, options?: FindMessagesOptions): Promise<Message[]> {
    const uuid = extractUuid('session_', sessionId)
    if (uuid === null) return []
    const limit = options?.limit

    const rows =
      limit === undefined
        ? await this.sql<MessageRow[]>`
            SELECT id, session_id, role, content, created_at, metadata
            FROM messages
            WHERE session_id = ${uuid}
            ORDER BY created_at ASC
          `
        : await this.sql<MessageRow[]>`
            SELECT id, session_id, role, content, created_at, metadata
            FROM messages
            WHERE session_id = ${uuid}
            ORDER BY created_at ASC
            LIMIT ${limit}
          `

    return rows.map(rowToMessage)
  }

  async deleteBySessionId(sessionId: string): Promise<number> {
    const uuid = extractUuid('session_', sessionId)
    if (uuid === null) return 0
    const result = await this.sql`
      DELETE FROM messages
      WHERE session_id = ${uuid}
    `
    return result.count
  }
}
