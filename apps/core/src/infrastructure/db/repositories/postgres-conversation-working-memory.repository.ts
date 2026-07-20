import type { Sql } from 'postgres'
import type { IConversationWorkingMemoryRepository } from '../../../application/ports/IConversationWorkingMemoryRepository.js'
import type { ConversationWorkingMemory } from '../../../domain/memory/memory.types.js'
import { extractUuid, stripPrefix } from './id-prefix.js'

type ConversationWorkingMemoryRow = {
  conversation_id: string
  session_id: string
  avatar_id: string
  summary: string
  unresolved_threads: unknown
  covered_topics: unknown
  candidate_facts: unknown
  updated_at: Date
}

function rowToConversationWorkingMemory(
  row: ConversationWorkingMemoryRow,
): ConversationWorkingMemory {
  const candidateFacts = Array.isArray(row.candidate_facts) ? row.candidate_facts : []
  return {
    conversationId: `conversation_${row.conversation_id}`,
    sessionId: `session_${row.session_id}`,
    avatarId: `avatar_${row.avatar_id}`,
    summary: row.summary,
    unresolvedThreads: readStringArray(row.unresolved_threads),
    coveredTopics: readStringArray(row.covered_topics),
    candidateFacts: candidateFacts
      .filter((fact) => isRecord(fact))
      .map((fact) => ({
        category: toStringOrEmpty(fact['category']),
        key: toStringOrEmpty(fact['key']),
        value: toStringOrEmpty(fact['value']),
      }))
      .filter((fact) => fact.category.length > 0 && fact.key.length > 0 && fact.value.length > 0),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresConversationWorkingMemoryRepository implements IConversationWorkingMemoryRepository {
  constructor(private readonly sql: Sql) {}

  async findByConversationId(conversationId: string): Promise<ConversationWorkingMemory | null> {
    const conversationUuid = extractUuid('conversation_', conversationId)
    if (conversationUuid === null) return null

    const [row] = await this.sql<[ConversationWorkingMemoryRow?]>`
      SELECT conversation_id, session_id, avatar_id, summary, unresolved_threads, covered_topics, candidate_facts, updated_at
      FROM conversation_working_memories
      WHERE conversation_id = ${conversationUuid}
    `
    return row === undefined ? null : rowToConversationWorkingMemory(row)
  }

  async upsert(
    memory: Omit<ConversationWorkingMemory, 'updatedAt'>,
  ): Promise<ConversationWorkingMemory> {
    const conversationUuid = stripPrefix('conversation_', memory.conversationId)
    const sessionUuid = stripPrefix('session_', memory.sessionId)
    const avatarUuid = stripPrefix('avatar_', memory.avatarId)

    const [row] = await this.sql<[ConversationWorkingMemoryRow?]>`
      INSERT INTO conversation_working_memories (
        conversation_id,
        session_id,
        avatar_id,
        summary,
        unresolved_threads,
        covered_topics,
        candidate_facts
      )
      VALUES (
        ${conversationUuid},
        ${sessionUuid},
        ${avatarUuid},
        ${memory.summary},
        ${memory.unresolvedThreads},
        ${memory.coveredTopics},
        ${this.sql.json(memory.candidateFacts)}
      )
      ON CONFLICT (conversation_id)
      DO UPDATE SET
        session_id = EXCLUDED.session_id,
        avatar_id = EXCLUDED.avatar_id,
        summary = EXCLUDED.summary,
        unresolved_threads = EXCLUDED.unresolved_threads,
        covered_topics = EXCLUDED.covered_topics,
        candidate_facts = EXCLUDED.candidate_facts,
        updated_at = NOW()
      RETURNING conversation_id, session_id, avatar_id, summary, unresolved_threads, covered_topics, candidate_facts, updated_at
    `

    if (row === undefined) {
      throw new Error(
        `Conversation working memory upsert failed for conversationId=${memory.conversationId}.`,
      )
    }
    return rowToConversationWorkingMemory(row)
  }

  async deleteBySessionId(sessionId: string): Promise<number> {
    const sessionUuid = extractUuid('session_', sessionId)
    if (sessionUuid === null) return 0

    const rows = await this.sql<Array<{ conversation_id: string }>>`
      DELETE FROM conversation_working_memories
      WHERE session_id = ${sessionUuid}
      RETURNING conversation_id
    `
    return rows.length
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}
