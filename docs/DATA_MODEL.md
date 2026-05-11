# DATA_MODEL.md

> Context Engine observability note (EPIC 5.2):
> `contextTrace` exposed by admin session-context inspection is a bounded, computed runtime artifact.
> It is intentionally not persisted as a database entity in Phase A.

# Purpose

Define the current persistent data model for Gami DigiDouble Core.

The model favors:

- simplicity
- operational clarity
- low migration cost
- explicit ownership
- bounded runtime state
- future evolution

This document defines:

- persisted entities
- relationships
- ownership rules
- reset semantics
- indexing strategy

Runtime behavior and orchestration semantics are defined in:

- `ARCHITECTURE.md`
- `MEMORY_SYSTEM_SPEC.md`
- `GAME_MASTER_CONTRACT.md`

---

# Entity Overview

| Entity                          | Purpose                               |
| ------------------------------- | ------------------------------------- |
| `users`                         | User identity and lightweight persona |
| `scenarios`                     | Experience configuration              |
| `avatars`                       | Actors available in a scenario        |
| `sessions`                      | Durable user run container            |
| `conversations`                 | One bounded avatar interaction        |
| `messages`                      | Conversation messages                 |
| `gm_states`                     | Persisted Game Master runtime state   |
| `session_memories`              | Session-level compact memory          |
| `conversation_working_memories` | Active conversation working memory    |
| `avatar_session_memories`       | Avatar-scoped session memory          |
| `conversation_memories`         | Long-term episodic memories           |
| `user_memory_facts`             | Persistent user facts                 |
| `knowledge_sources`             | Registered knowledge assets           |
| `knowledge_chunks`              | Retrieval chunks                      |
| `event_log`                     | Runtime observability events          |
| `ingestion_jobs`                | Knowledge ingestion tracking          |
| `admin_action_log`              | Operator audit trail                  |
| `prompt_template_variables`     | Optional reusable prompt variables    |

---

# Entities

---

# 1. User

Represents a user or external identity.

## Fields

- id
- external_id
- email
- persona (JSONB)
- metadata (JSONB)
- created_at
- updated_at

## Persona Shape

```ts id="94v5ra"
type UserPersona = {
  name?: string
  roleInWorld?: string
  avatarRelationships?: string[]
  dialogGuidance?: string
}
```

## Notes

- Persona is optional
- Persona is assembled into runtime context
- Persona is not duplicated into sessions or messages

---

# 2. Scenario

Defines a runnable experience.

## Fields

- id
- name
- status (`draft | active | archived`)
- config (JSONB)
- created_at
- updated_at

## Notes

A scenario owns:

- avatars
- knowledge sources
- runtime configuration

Scenario configuration is data, not code.

---

# 3. Avatar

Represents one actor inside a scenario.

## Fields

- id
- scenario_id
- name
- status (`draft | active | archived`)
- description
- tone
- persona_prompt
- config (JSONB)
- created_at
- updated_at

## Notes

- One avatar belongs to exactly one scenario
- Cross-scenario reuse is intentionally unsupported in Phase A

---

# 4. Session

Represents one user run inside one scenario.

## Fields

- id
- user_id
- scenario_id
- active_avatar_id
- unlocked_avatar_ids
- gm_notes
- memory_summary
- status (`active | closed | archived`)
- started_at
- last_activity_at
- ended_at

## Notes

- One session contains multiple conversations
- Session is the durable runtime container
- Runtime context is assembled from bounded memory layers
- `memory_summary` is a compatibility cache/mirror
- Runtime state is derived, not persisted

---

# 5. Conversation

Represents one bounded dialogue episode with one avatar.

## Fields

- id
- session_id
- avatar_id
- status (`active | closed | archived`)
- started_by
- reason
- handoff_from_conversation_id
- started_at
- last_activity_at
- ended_at

## Notes

- Avatar switches create new conversations
- Conversation closure is the memory-compaction boundary
- Transcript replay is not the primary continuity mechanism

---

# 6. Message

Represents one message inside a conversation.

## Fields

- id
- conversation_id
- role (`user | avatar | system`)
- content
- metadata (JSONB)
- created_at

## Metadata Examples

- model
- latencyMs
- token counts
- cost
- trigger source

---

# 7. Game Master State

Persisted lightweight GM runtime state.

Table: `gm_states`

## Fields

- session_id
- current_avatar_id
- progression
- topics_covered
- interaction_count
- updated_at

## Notes

- One row per session
- Stores bounded orchestration continuity only

---

# 8. Session Memory

Compact session-level memory.

Table: `session_memories`

## Fields

- session_id
- summary
- updated_at

## Notes

- Stores compact session continuity
- Does not store transcripts
- One row per session

---

# 9. Conversation Working Memory

Active conversation-scoped working memory.

Table: `conversation_working_memories`

## Fields

- conversation_id
- session_id
- avatar_id
- summary
- unresolved_threads
- candidate_facts
- updated_at

## Notes

- Canonical active working memory
- Rewritten periodically
- One row per conversation

---

# 10. Avatar Session Memory

Avatar-scoped session memory.

Table: `avatar_session_memories`

## Fields

- session_id
- avatar_id
- summary
- updated_at

## Notes

- Stores avatar-specific continuity
- One row per `(session_id, avatar_id)`

---

# 11. Conversation Memory

Long-term episodic memory.

Table: `conversation_memories`

## Fields

- conversation_id
- session_id
- user_id
- avatar_id
- scenario_id
- summary
- key_discoveries
- unresolved_topics
- fact_candidates
- created_at

## Notes

- One row per closed conversation
- Retrieval scope:
  - user_id
  - avatar_id
  - scenario_id

---

# 12. User Memory Fact

Persistent structured user memory.

Table: `user_memory_facts`

## Fields

- id
- user_id
- category
- key
- value
- confidence
- updated_at

## Notes

- Stores facts, not transcripts
- Cross-session long-term memory
- Deduplicated when practical

---

# 13. Knowledge Source

Knowledge attached to a scenario.

Table: `knowledge_sources`

## Fields

- id
- scenario_id
- name
- knowledge_type (`memory | world | media`)
- format (`pdf | text | markdown | url | media`)
- uri_or_path
- status (`pending | ready | error`)
- metadata (JSONB)
- created_at

## Notes

Knowledge sources belong to scenarios.

Multi-layer retrieval uses metadata rather than additional tables.

---

# 14. Knowledge Chunk

Retrieval chunk.

Table: `knowledge_chunks`

## Fields

- id
- source_id
- content
- chunk_index
- embedding (pgvector)
- metadata (JSONB)
- created_at

## Notes

Stored in PostgreSQL + pgvector.

---

# 15. Event Log

Operational runtime events.

Table: `event_log`

## Fields

- id
- session_id
- type
- payload (JSONB)
- severity
- request_id
- correlation_id
- created_at

## Notes

Used for:

- runtime debugging
- observability
- metrics
- async flow tracing

No raw transcript payloads should be logged.

---

# 16. Ingestion Job

Knowledge ingestion lifecycle tracking.

Table: `ingestion_jobs`

## Fields

- id
- source_id
- status (`queued | running | completed | failed`)
- attempts
- started_at
- completed_at
- error_message
- created_at
- updated_at

---

# 17. Admin Action Log

Operator audit trail.

Table: `admin_action_log`

## Fields

- id
- actor
- action_type
- target_type
- target_id
- payload (JSONB)
- created_at

## Notes

- Append-only
- No PII in payloads

---

# 18. Prompt Template Variable

Optional reusable prompt variables.

Table: `prompt_template_variables`

## Fields

- id
- scenario_id
- key
- value
- updated_at

---

# Relationships

- User → Sessions (1:N)
- User → UserMemoryFacts (1:N)
- Scenario → Avatars (1:N)
- Scenario → Sessions (1:N)
- Scenario → KnowledgeSources (1:N)
- Session → Conversations (1:N)
- Session → GameMasterState (1:1)
- Session → SessionMemory (1:1)
- Session → AvatarSessionMemories (1:N)
- Conversation → Messages (1:N)
- Conversation → ConversationWorkingMemory (1:1)
- Conversation → ConversationMemory (1:1)
- Avatar → Conversations (1:N)
- KnowledgeSource → KnowledgeChunks (1:N)
- KnowledgeSource → IngestionJobs (1:N)
- Session → EventLogs (1:N)

---

# Derived Runtime State

The following runtime state is derived and not persisted directly:

- session runtime state
- SSE runtime stream state
- processing state
- pending runtime events

Derived runtime state is assembled from:

- sessions
- conversations
- async world-processing signals
- runtime event streams

---

# JSONB Usage Rules

JSONB is allowed for evolving structures:

- scenario config
- avatar config
- message metadata
- knowledge metadata
- event payloads
- prompt variables

Core relational ownership must never be hidden inside JSONB.

Never hide:

- session ownership
- avatar ownership
- conversation ownership
- message relationships
- memory relationships

---

# Reset Rules

## Reset Session

Deletes:

- conversations
- messages
- memories
- runtime events

Clears:

- active_avatar_id
- unlocked_avatar_ids
- gm_notes

Resets:

- status → `active`
- last_activity_at

Keeps:

- users
- scenarios
- avatars
- knowledge sources
- user memory facts

---

## Reset User

Deletes:

- sessions
- memories
- user memory facts
- logs

Keeps:

- scenarios
- avatars
- knowledge sources

---

# Suggested Indexes

## Sessions

- `(user_id, last_activity_at)`
- `(scenario_id, last_activity_at)`

## Conversations

- `(session_id, started_at)`
- `(session_id, avatar_id, started_at)`

## Messages

- `(conversation_id, created_at)`

## Avatars

- `(scenario_id, status)`

## Memory

- `avatar_session_memories(session_id, avatar_id)` UNIQUE
- `user_memory_facts(user_id, category)`

## Knowledge

- `knowledge_sources(scenario_id)`
- `knowledge_chunks(source_id)`

## Events

- `event_log(session_id)`
- `event_log(type)`

---

# Phase A Non-Goals

Not modeled in Phase A:

- shared avatar library
- multi-tenant billing
- story graph tables
- emotional state tables
- prompt versioning
- analytics warehouse
- orchestration graph persistence

---

# Evolution Rules

Introduce new entities only when justified by:

- runtime complexity
- operational need
- retrieval quality
- orchestration requirements
- scalability constraints

Prefer extending existing bounded models before introducing new top-level entities.

---

# Final Rule

If data is not used by:

- runtime behavior
- operations
- observability
- retrieval
- learning systems

then it should not be stored.
