# DATA_MODEL.md

## Purpose

Define the current minimal data model for the MVP Core.

This model favors:

- simplicity
- fast iteration
- operational clarity
- low migration cost
- future evolution

Use YAGNI and KISS:

- store only what we use
- avoid premature entities
- prefer explicit structures
- evolve when real needs appear

---

## Core Principles

- PostgreSQL is the source of truth
- JSONB is acceptable for flexible configuration
- Session memory and persistent memory are different concerns
- Avatar memory inside a session is a first-class concern
- Derived data can be recomputed when practical
- Every important entity must be deletable/resettable

---

# Main Entities

---

## 1. User

Represents a person or external identity using the system.

### Fields

- id
- created_at
- updated_at

### Optional

- external_id
- email
- metadata (JSONB)
- persona (JSONB)

### Notes

Keep minimal until stronger auth or tenancy is required.

`persona` is intentionally lightweight and optional. Suggested shape:

- `role` (e.g. friend, coach, psychologist)
- `tonePreference` (e.g. direct, warm, concise)
- `interactionHints?: string[]` (optional short hints)

Persona is consumed by the Context module at assembly time. It is not duplicated across session, conversation, or message rows.

### Implementation Status (EPIC 5.5)

- **Table:** `users`
- **Repository:** `PostgresUserRepository`
- **Status:** Fully implemented. `persona` is a JSONB column; all fields optional.
- **Column note:** `id` is `TEXT` (not UUID) — mirrors `sessions.user_id TEXT`.

---

## 2. Scenario

Defines a runnable experience configuration.

### Fields

- id
- name
- status (draft / active / archived)
- config (JSONB)
- created_at
- updated_at

### Implementation Alignment (TypeScript)

- `Scenario` includes: `scenarioId`, `name`, `status`, `config`, `createdAt`, `updatedAt`.
- `status` is constrained to `'draft' | 'active' | 'archived'`.
- `config` is a typed object (`ScenarioConfig`) carrying scenario runtime settings.

### Implementation Status (EPIC 2.3)

- **Table:** `scenarios`
- **Migration:** `apps/core/src/infrastructure/db/migrations/001_initial_schema.sql`
- **Repository:** `PostgresScenarioRepository`
- **Status:** Fully implemented.
- **Column note:** `updated_at` is automatically refreshed to `NOW()` on every `UPDATE` via the repository's `update()` method (`SET updated_at = NOW()` in the SQL statement), including partial updates via `PATCH /v1/scenarios/{scenarioId}`.

### Typical Config

- world context
- objectives
- goals
- avatar availability policy (`initialAvatarIds`, optional `unlockableAvatarIds`)
- UI hints
- runtime defaults

### Notes

Scenario config is data, not code.

A Scenario owns:

- its avatars
- its knowledge sources
- its rules/configuration

The Scenario is the container of the experience.

---

## 3. Avatar

Represents an actor available in one scenario.

An Avatar is now a first-class object.

### Fields

- id
- scenario_id
- name
- status (draft / active / archived)
- description (nullable)
- tone (nullable)
- persona_prompt (required, non-null)
- config (JSONB, required, extensible)
- created_at
- updated_at

### Implementation Alignment (TypeScript)

- `AvatarConfig` keeps runtime-first naming (`avatarId`) while still carrying database-sourced timestamps for API responses and auditing use cases.

### Implementation Status (EPIC 2.3)

- **Table:** `avatars`
- **Migration:** `apps/core/src/infrastructure/db/migrations/001_initial_schema.sql`
- **Repository:** `PostgresAvatarRepository`
- **Status:** Fully implemented. The `adjustments` field (runtime-only, from `AvatarConfig`) is not persisted in Phase A and remains in-memory only. Add a `TEXT[]` column via a future migration if persistence is required.
- **Column note:** `updated_at` is automatically refreshed to `NOW()` on every `UPDATE` via the repository's `update()` method (`SET updated_at = NOW()` in the SQL statement), including partial updates via `PATCH /v1/avatars/{avatarId}`.

### Typical Config

- speaking style details
- role in the experience
- response constraints
- allowed knowledge scope
- optional voice / media references
- optional UI hints

### Notes

An Avatar belongs to exactly one Scenario.

This keeps the model simple for now:

- no shared avatar library
- no cross-scenario avatar reuse
- no separate actor catalog yet

If shared avatars become a real product need later, we can evolve toward:

- reusable Avatar templates
- ScenarioAvatar binding table

For MVP, one Avatar = one actor defined inside one Scenario.

**Phase A deletion safety rule:** avatar deletion is rejected while the owning scenario has active sessions.

---

## 4. Session

Represents one user run through one scenario.

### Fields

- id
- user_id
- scenario_id
- active_avatar_id (nullable, FK → Avatar)
- unlocked_avatar_ids (nullable UUID[], session-scoped available avatars)
- gm_notes (nullable, director guidance for next avatar turn)
- memory_summary (nullable, compact working-memory summary for the session)
- status (active / closed / archived)
- started_at
- last_activity_at
- ended_at (nullable)

### Implementation Status (EPIC 2.3)

- **Table:** `sessions`
- **Migration:** `apps/core/src/infrastructure/db/migrations/001_initial_schema.sql`
- **Repository:** `PostgresSessionRepository`
- **Status:** Fully implemented.
- **Column note:** `active_avatar_id` is nullable and persisted for GM-driven default avatar routing. Cleared to `NULL` on session reset.
- **Column note:** `unlocked_avatar_ids` stores per-session avatar unlock progression when scenario policy enables locked specialists. Initial values come from scenario availability policy; later additions are owned by the async Game Master. Cleared to the scenario's initial unlocked avatars on session reset.
- **Column note:** `gm_notes` stores latest Game Master guidance injected into the next avatar system prompt. Cleared to `NULL` on session reset.
- **Column note:** `memory_summary` stores compact working memory for fast context hydration; it is bounded and updated asynchronously, then cleared on session reset.

### Notes

One session can contain multiple conversations over time.

`active_avatar_id` tracks the current routing focus for session-level orchestration.
`unlocked_avatar_ids` tracks which avatars are accessible in that specific session.
At turn time, long-term user facts (`UserMemoryFact`) are fetched (bounded) and injected into the avatar system prompt as lightweight user context.

A Session is the equivalent of one run of the experience.

Using the movie analogy:

- Scenario = the production setup
- Avatar = an actor in that production
- Session = one concrete movie/playthrough container

### Derived runtime state (EPIC 4.5)

`session_runtime_state` is derived at read time from session/conversation status plus async world-processing signals.

- It is **not** a persisted table in Phase A.
- It is exposed through API (`GET /v1/sessions/{sessionId}/runtime-state`) and SSE event flow.
- World-processing signals are sourced from an in-process session event publisher (`InMemorySessionEventPublisher`) and are process-scoped (not DB-backed) in Phase A.
- Keep this model derived/simple to avoid premature event-sourcing complexity.

---

## 5. Conversation

Represents one bounded dialogue episode with one avatar inside one session.

### Fields

- id
- session_id
- avatar_id
- status (active / closed / archived)
- started_at
- last_activity_at
- ended_at (nullable)

### Optional

- started_by (user / gm / system)
- reason (nullable)
- handoff_from_conversation_id (nullable)

### Notes

- Switching avatar creates a new conversation.
- Returning later to the same avatar also creates a new conversation.
- Conversation history is isolated per conversation.
- Session memory continuity should happen through SessionMemory / AvatarSessionMemory, not by raw transcript continuation by default.
- Conversation closure (`status = closed` + `ended_at`) is the trigger boundary for conversation → memory compaction. Compaction is async and must not block the response path.

**Phase A deletion safety rule:** scenario deletion is rejected while dependent avatars or sessions still exist.

---

## 6. Message

Represents one message in a conversation.

### Fields

- id
- conversation_id
- role (user / avatar / system)
- content
- created_at

### Optional

- metadata (JSONB)

### Implementation Status (EPIC 2.3)

- **Table:** `messages`
- **Migration:** `apps/core/src/infrastructure/db/migrations/001_initial_schema.sql`
- **Repository:** `PostgresMessageRepository`
- **Status:** Fully implemented.

### Metadata Shape (JSONB)

Current `MessageMetadata` fields:

- `model?`
- `latencyMs?`
- `inputTokens?`
- `outputTokens?`
- `totalTokens?`
- `costUsd?`
- `triggerSource?`

### Notes

Use one table for all messages.

The speaking avatar is derived from the parent conversation.

Avoid separate Exchange tables unless clearly needed later.

---

## 7. GameMasterState (`gm_states`)

Lightweight persisted per-session Game Master state used to keep progression continuity across turns and server restarts.

### Fields

- session_id (PK, FK → Session, ON DELETE CASCADE)
- current_avatar_id (nullable)
- progression
- topics_covered (`TEXT[]`)
- interaction_count
- updated_at

### Notes

- Exactly one row per session (`session_id` is both PK and FK).
- Deleting a session cascades and removes its GM state row.
- Stores only the minimal `GameMasterState` persistence shape.

### Implementation Status (EPIC 4.1)

- **Table:** `gm_states`
- **Schema source:** `infra/postgres/init.sql`
- **Repository:** `PostgresGmStateRepository`
- **Status:** Fully implemented.

---

## 8. SessionMemory

Compact working memory for an active session.

### Fields

- session_id
- summary
- updated_at

### Notes

Recent raw messages come from Message table.

This table stores only compacted session-level memory (working memory layer).

The memory model is pyramidal and bounded:

- Short-term memory: last 2 exchanges (assembled at runtime from `Message`; not persisted here)
- Working memory: evolving session summary (canonical row in `session_memories`; `sessions.memory_summary` kept as backward-compatible mirror/cache during migration)
- Long-term memory: persisted structured facts/events (`UserMemoryFact`)

This is the shared memory of the session itself:

- what happened globally
- what the overall interaction has covered
- what the system may need regardless of a specific avatar

Using the analogy:

This is the memory of the movie/playthrough as a whole.

### Implementation Status (EPIC 4.2b)

- **Table:** `session_memories`
- **Repository:** `PostgresSessionMemoryRepository` (+ in-memory test adapter)
- **Status:** Implemented. One row per session (`session_id` PK), compact `summary`, `updated_at`.

---

## 9. AvatarSessionMemory

Compact working memory for one avatar inside one session.

### Fields

- session_id
- avatar_id
- summary
- updated_at

### Notes

This stores what happened for a specific avatar in a specific session.

Examples:

- what this avatar already told the user
- what this avatar has learned in the conversation
- emotional or narrative continuity if later needed
- unresolved threads from this avatar’s point of view

This is intentionally separate from `SessionMemory`.

Why:

- session memory = global memory of the experience
- avatar session memory = subjective memory of one actor in that experience

This follows the Director / Actor analogy:

- SessionMemory = shared movie memory
- AvatarSessionMemory = actor memory for that movie

For MVP, keep it compact:

- one summary per `(session_id, avatar_id)`
- no raw transcript duplication
- no complex episodic memory yet

### Implementation Status (EPIC 4.2b)

- **Table:** `avatar_session_memories`
- **Repository:** `PostgresAvatarSessionMemoryRepository` (+ in-memory test adapter)
- **Status:** Implemented. One compact summary row per `(session_id, avatar_id)`.

---

## 10. UserMemoryFact

Persistent structured memory about a user.

### Fields

- id
- user_id
- category
- key
- value
- confidence (nullable)
- updated_at

### Examples

- preference / language / goal
- known topic interest
- recurring constraint

### Notes

Store facts, not transcripts.

This memory is cross-session and user-centric (long-term layer). Facts/events should be compact, structured, and deduplicated when practical.
Fact extraction is triggered when a conversation is closed and runs asynchronously/non-blocking (fire-and-forget) so close latency is unaffected.
Facts are injected into avatar turn context on message handling via a bounded key/value map (`{ [key]: value }`), aligned with the same long-term memory concept used by Game Master input.
Phase A status: implemented end-to-end (`user_memory_facts` persistence, async extraction trigger on close, and bounded injection into avatar context at turn-time with max 10 facts).

### Implementation Status (EPIC 4.2)

- **Table:** `user_memory_facts`
- **Repository:** `PostgresUserMemoryFactRepository`
- **Status:** Fully implemented. `id` uses `umf_` prefix. `(user_id, category, key)` is unique.

---

## 11. KnowledgeSource

A document or external source attached to a scenario.

### Fields

- id
- scenario_id
- name
- type (pdf / text / markdown / url / media)
- uri_or_path
- status (pending / ready / error)
- metadata (JSONB)
- created_at

### Notes

Content files may live outside the Core.

The Core stores references + metadata.

Knowledge sources belong to the Scenario, not to a specific avatar.

An avatar may later use only part of the scenario knowledge, controlled by config.

Multi-layer RAG stays simple by extending `type` + `metadata`, not by new core tables:

- Avatar memory RAG: `type = 'text' | 'markdown'`, `metadata.layer = 'avatar-memory'`, optional `metadata.avatarId`
- Scenario/world RAG: `metadata.layer = 'world'`
- Media RAG: `type = 'media'`, `metadata.layer = 'media'`, optional media descriptors (mime, duration, tags)

---

## 12. KnowledgeChunk

Searchable chunk used for retrieval.

### Fields

- id
- source_id
- content
- embedding
- metadata (JSONB)

### Notes

Stored in PostgreSQL + pgvector.

---

## 13. EventLog

Operational events useful for debugging and metrics.

### Fields

- id
- session_id (nullable)
- type
- payload (JSONB)
- created_at
- **request_id** (nullable) — correlates with the originating HTTP request
- **correlation_id** (nullable) — groups events across async boundaries (e.g. one turn → GM trigger → memory update)
- **severity** — `info` | `warning` | `error`

### Optional payload examples

- avatar_id
- gm decision
- retrieval used
- fallback used
- llm error details
- state update info

### Examples

- gm_triggered
- turn_completed
- retrieval_used
- llm_error
- fallback_used
- session_started
- avatar_switched
- avatar_memory_updated

### Notes

Use only events that are actually useful.

### Implementation Status (EPIC 4.1)

- **Table:** `event_log` created in `infra/postgres/init.sql` with indexes on `session_id` and `type`
- **Port:** `IEventLogRepository` in `apps/core/src/application/ports/IEventLogRepository.ts`
- **In-memory:** `InMemoryEventLogRepository` in `apps/core/src/infrastructure/db/in-memory-event-log.repository.ts`
- **Postgres:** `PostgresEventLogRepository` in `apps/core/src/infrastructure/db/repositories/postgres-event-log.repository.ts`
- **Domain type:** `GameMasterEvent` added to `apps/core/src/domain/game-master/game-master.types.ts`
- **Status:** Fully implemented. Used for GM diagnostics and turn timing events (`gm_triggered`, `gm_error`, `turn_completed`).
- `SendMessageUseCase` appends `turn_completed` for each successful avatar turn (includes latency and token metrics in payload)
- GM emits `gm_triggered` after successful post-turn evaluation and `gm_error` for safe GM failures via `RunGameMasterUseCase`; `gm_triggered` payload includes latency/tokens plus mirrored `correlationId` for query joins

### Event: `turn_completed`

Emitted by `SendMessageUseCase` after each successful avatar turn using fire-and-forget event append semantics.

Payload fields:

- `conversationId` — string
- `turnIndex` — number (1-based count of user turns in the conversation)
- `avatarId` — string
- `avatarLatencyMs` — number (avatar LLM call wall clock from `ILlmAdapter.complete`)
- `totalTurnLatencyMs` — number (full `SendMessageUseCase` wall clock)
- `inputTokens` — number
- `outputTokens` — number
- `totalTokens` — number
- `model` — string
- `hasGm` — boolean (whether a GM background run was dispatched)

### Event: `gm_triggered` (enriched)

Pre-existing event type; payload includes the following performance fields used by EPIC 4.3 metrics:

- `latencyMs` — number (GM LLM call wall clock)
- `inputTokens` — number
- `outputTokens` — number

The `StoredEvent.correlationId` links `gm_triggered` events to parent `turn_completed` events (shared request correlation).

### Event family: `memory_refresh_*` (working-memory maintenance lifecycle)

Emitted by `MemoryMaintenanceService` in fire-and-forget mode from turn and close flows.

Event types:

- `memory_refresh_triggered`
- `memory_refresh_succeeded`
- `memory_refresh_failed`

Payload includes compact operational fields only (session/conversation/avatar ids, trigger source, summary lengths/message count on success, short error message on failure). No raw transcript payloads are logged.

The `request_id` and `correlation_id` fields are essential for tracing failures across async flows without requiring a full distributed tracing stack.

---

## 14. IngestionJob

Tracks the lifecycle of a knowledge source ingestion job.

Required for operator visibility into the knowledge pipeline status.

### Fields

- id
- source_id (FK → KnowledgeSource)
- status — `pending` | `running` | `completed` | `failed`
- attempts (int, default 0)
- started_at (nullable)
- completed_at (nullable)
- error_message (nullable)
- created_at

### Notes

One job per ingestion attempt.

On failure, the status moves to `failed` and `error_message` stores the reason.
Retry creates a new job row (or increments `attempts`) depending on the retry strategy chosen.

Admin API exposes these rows directly for inspection and manual retry.

---

## 15. AdminActionLog

Audit trail of all admin actions taken through the admin API.

Provides accountability and debugging context for operator interventions.

### Fields

- id
- actor — the API key identifier or operator label that performed the action
- action_type — e.g. `session.reset`, `session.replay`, `job.retry`, `scenario.archive`
- target_type — `session` | `job` | `scenario` | `source`
- target_id — the ID of the affected entity
- payload (JSONB, nullable) — parameters passed to the action
- created_at

### Notes

Never delete from this table.

Kept as an append-only audit log.

No PII in payload — store IDs and structured metadata only.

---

## 16. PromptTemplateVariable (Optional)

Reusable scenario-level variables injected into prompt/template fragments.

### Fields

- id
- scenario_id
- key
- value
- updated_at

### Notes

Keep optional for MVP.

Use only when repeated prompt/template fragments need explicit editable variables instead of hidden prompt edits.

---

# Relationships

- User → Sessions (1:N)
- User → UserMemoryFacts (1:N)
- Scenario → Avatars (1:N)
- Scenario → Sessions (1:N)
- Scenario → KnowledgeSources (1:N)
- Session → Conversations (1:N)
- Session → GameMasterState (1:1)
- Conversation → Messages (1:N)
- Session → SessionMemory (1:1)
- Session → AvatarSessionMemories (1:N)
- Avatar → Conversations (1:N)
- Avatar → AvatarSessionMemories (1:N)
- KnowledgeSource → KnowledgeChunks (1:N)
- KnowledgeSource → IngestionJobs (1:N)
- Session → EventLogs (1:N)
- Scenario → PromptTemplateVariables (1:N, optional)

---

# What Lives in JSONB

Use JSONB when structure may evolve quickly:

- scenario config
- avatar config
- message metadata
- source metadata
- event payloads
- prompt/template variables when scenario-authoring needs reusable placeholders (if not modeled relationally)

Do **not** hide core relational data inside JSONB.

In particular, do not hide:

- avatar ownership
- session ownership
- conversation/session relations
- message/conversation relations
- avatar/session memory relations

---

# What We Intentionally Avoid (For Now)

- shared avatar library across scenarios
- separate Storyworld table
- separate Place table
- node graph tables
- emotional state tables
- multi-tenant billing tables
- prompt versioning tables
- raw analytics warehouse

These can be introduced when usage justifies them.

---

# Reset Rules

## Reset Session

Deletes:

- conversations
- messages
- session memory
- avatar session memories
- session events

Clears on the session record (fields set to null / empty):

- `activeAvatarId` → `null`
- `unlockedAvatarIds` → `[]`
- `gmNotes` → `null`

Resets on the session record:

- `status` → `'active'`
- `lastActivityAt` → current timestamp

Keeps:

- user
- scenario
- avatars
- knowledge sources
- user memory facts

## Reset User

Deletes:

- sessions
- session memories
- avatar session memories through sessions
- user memory facts
- related logs

Keeps:

- scenarios
- avatars
- knowledge sources

---

# Suggested Indexes (Minimal)

- sessions(user_id, last_activity_at)
- sessions(scenario_id, last_activity_at)
- conversations(session_id, started_at)
- conversations(session_id, avatar_id, started_at)
- avatars(scenario_id, status)
- messages(conversation_id, created_at)
- avatar_session_memories(session_id, avatar_id)
- user_memory_facts(user_id, category)
- knowledge_sources(scenario_id)
- knowledge_chunks(source_id)
- event_log(session_id)
- event_log(type)

Add unique indexes where relevant:

- avatar_session_memories(session_id, avatar_id)

Vector index added when chunk volume justifies it.

---

# Evolution Path (Later)

Introduce only when needed:

- shared Avatar templates across scenarios
- ScenarioAvatar binding table
- Place / location model
- Purpose / Frame model
- node / graph runtime state
- multi-avatar orchestration state tables
- tenant isolation
- evaluation results tables
- billing / quotas
- dedicated analytics store

---

# Final Rule

If data is not used by product logic, operations, or learning:

**do not store it**
