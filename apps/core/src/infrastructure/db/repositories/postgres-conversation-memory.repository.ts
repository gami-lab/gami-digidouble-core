import type { Sql } from 'postgres'
import type { IConversationMemoryRepository } from '../../../application/ports/IConversationMemoryRepository.js'
import type { ConversationMemory } from '../../../domain/memory/memory.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

type ConversationMemoryRow = {
  conversation_id: string
  session_id: string
  user_id: string
  avatar_id: string
  scenario_id: string
  summary: string
  key_discoveries: string[]
  unresolved_topics: string[]
  fact_candidates: unknown
  created_at: Date
}

export class PostgresConversationMemoryRepository implements IConversationMemoryRepository {
  constructor(private readonly sql: Sql) {}

  async findByConversationId(conversationId: string): Promise<ConversationMemory | null> {
    const conversationUuid = extractUuid('conversation_', conversationId)
    if (conversationUuid === null) return null
    const [row] = await this.sql<[ConversationMemoryRow?]>`
      SELECT conversation_id, session_id, user_id, avatar_id, scenario_id, summary, key_discoveries, unresolved_topics, fact_candidates, created_at
      FROM conversation_memories
      WHERE conversation_id = ${conversationUuid}
    `
    return row === undefined ? null : rowToConversationMemory(row)
  }

  async create(memory: Omit<ConversationMemory, 'createdAt'>): Promise<ConversationMemory> {
    const conversationUuid = stripPrefix('conversation_', memory.conversationId)
    const sessionUuid = stripPrefix('session_', memory.sessionId)
    const avatarUuid = stripPrefix('avatar_', memory.avatarId)
    const scenarioUuid = stripPrefix('scenario_', memory.scenarioId)
    const [row] = await this.sql<[ConversationMemoryRow?]>`
      INSERT INTO conversation_memories (
        conversation_id, session_id, user_id, avatar_id, scenario_id, summary, key_discoveries, unresolved_topics, fact_candidates
      )
      VALUES (
        ${conversationUuid},
        ${sessionUuid},
        ${memory.userId},
        ${avatarUuid},
        ${scenarioUuid},
        ${memory.summary},
        ${memory.keyDiscoveries},
        ${memory.unresolvedTopics},
        ${this.sql.json(memory.factCandidates)}
      )
      ON CONFLICT (conversation_id) DO NOTHING
      RETURNING conversation_id, session_id, user_id, avatar_id, scenario_id, summary, key_discoveries, unresolved_topics, fact_candidates, created_at
    `
    if (row !== undefined) return rowToConversationMemory(row)
    const existing = await this.findByConversationId(memory.conversationId)
    if (existing !== null) return existing
    throw new Error(
      `Conversation memory create failed for conversationId=${memory.conversationId}.`,
    )
  }

  async listByScope(input: {
    userId: string
    avatarId: string
    scenarioId: string
    limit: number
  }): Promise<ConversationMemory[]> {
    const avatarUuid = extractUuid('avatar_', input.avatarId)
    const scenarioUuid = extractUuid('scenario_', input.scenarioId)
    if (avatarUuid === null || scenarioUuid === null) return []
    const rows = await this.sql<ConversationMemoryRow[]>`
      SELECT conversation_id, session_id, user_id, avatar_id, scenario_id, summary, key_discoveries, unresolved_topics, fact_candidates, created_at
      FROM conversation_memories
      WHERE user_id = ${input.userId}
        AND avatar_id = ${avatarUuid}
        AND scenario_id = ${scenarioUuid}
      ORDER BY created_at DESC
      LIMIT ${input.limit}
    `
    return rows.map(rowToConversationMemory)
  }

  async deleteBySessionId(sessionId: string): Promise<number> {
    const sessionUuid = extractUuid('session_', sessionId)
    if (sessionUuid === null) return 0
    const rows = await this.sql<Array<{ conversation_id: string }>>`
      DELETE FROM conversation_memories
      WHERE session_id = ${sessionUuid}
      RETURNING conversation_id
    `
    return rows.length
  }
}

function rowToConversationMemory(row: ConversationMemoryRow): ConversationMemory {
  return {
    conversationId: `conversation_${row.conversation_id}`,
    sessionId: `session_${row.session_id}`,
    userId: row.user_id,
    avatarId: `avatar_${row.avatar_id}`,
    scenarioId: `scenario_${row.scenario_id}`,
    summary: row.summary,
    keyDiscoveries: row.key_discoveries,
    unresolvedTopics: row.unresolved_topics,
    factCandidates: toFactCandidates(row.fact_candidates),
    createdAt: row.created_at.toISOString(),
  }
}

function toFactCandidates(value: unknown): Array<{ category: string; key: string; value: string }> {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((item) => ({
      category: toText(item['category']),
      key: toText(item['key']),
      value: toText(item['value']),
    }))
    .filter((item) => item.category.length > 0 && item.key.length > 0 && item.value.length > 0)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
