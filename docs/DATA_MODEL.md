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

### Notes

Keep minimal until stronger auth or tenancy is required.

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

### Typical Config

- world context
- objectives
- goals
- pacing rules
- transition settings
- enabled features
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

- `Avatar` (persistence shape) includes all fields above with camelCase names: `id`, `scenarioId`, `name`, `status`, `personaPrompt`, optional `tone`, optional `description`, required extensible `config`, `createdAt`, `updatedAt`.
- `AvatarConfig` (runtime shape used by prompt assembly and send-message flow) includes: `avatarId`, `scenarioId`, `name`, `status`, required `personaPrompt`, optional `tone`, optional `description`, optional typed `adjustments: string[]` (ordered style adjustments appended to the assembled system prompt), optional extensible `config`, and persistence timestamps `createdAt` / `updatedAt`.
- `AvatarConfig` keeps runtime-first naming (`avatarId`) while still carrying database-sourced timestamps for API responses and auditing use cases.
- Avatar creation input in application layer maps to runtime config fields: `scenarioId`, `name`, `personaPrompt`, optional `tone`, `description`, `adjustments`, `config`, and optional `status`.

### Implementation Status (EPIC 2.3)

- **Table:** `avatars`
- **Migration:** `apps/core/src/infrastructure/db/migrations/001_initial_schema.sql`
- **Repository:** `PostgresAvatarRepository`
- **Status:** Fully implemented. The `adjustments` field (runtime-only, from `AvatarConfig`) is not persisted in Phase A and remains in-memory only. Add a `TEXT[]` column via a future migration if persistence is required.

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
- gm_notes (nullable, director guidance for next avatar turn)
- status (active / closed / archived)
- started_at
- last_activity_at
- ended_at (nullable)

### Implementation Status (EPIC 2.3)

- **Table:** `sessions`
- **Migration:** `apps/core/src/infrastructure/db/migrations/001_initial_schema.sql`
- **Repository:** `PostgresSessionRepository`
- **Status:** Fully implemented.
- **Column note:** `active_avatar_id` is nullable and persisted for GM-driven default avatar routing.
- **Column note:** `gm_notes` stores latest Game Master guidance injected into the next avatar system prompt.

### Notes

One session can contain multiple conversations over time.

`active_avatar_id` tracks the current routing focus for session-level orchestration.

A Session is the equivalent of one run of the experience.

Using the movie analogy:

- Scenario = the production setup
- Avatar = an actor in that production
- Session = one concrete movie/playthrough container

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
- **Status:** Implemented.

---

## 8. SessionMemory

Compact working memory for an active session.

### Fields

- session_id
- summary
- updated_at

### Notes

Recent raw messages come from Message table.

This table stores only compacted session-level memory.

This is the shared memory of the session itself:

- what happened globally
- what the overall interaction has covered
- what the system may need regardless of a specific avatar

Using the analogy:

This is the memory of the movie/playthrough as a whole.

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

This memory is cross-session and user-centric.

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
- retrieval_used
- llm_error
- fallback_used
- session_started
- avatar_switched
- avatar_memory_updated

### Notes

Use only events that are actually useful.

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

## 16. AvatarTransitionRule

Lightweight transition policy attached to a scenario.

### Fields

- id
- scenario_id
- from_avatar_id (nullable)
- to_avatar_id
- trigger_type (`topic` | `progression` | `manual_choice` | `system`)
- priority (int, default 0)
- is_enabled (boolean, default true)
- config (JSONB, nullable)
- created_at
- updated_at

### Notes

Keep this simple in MVP.

`config` may store optional rule details (topic match, progression threshold, content trigger key, additional constraints) without introducing complex graph tables.

---

## 17. PromptTemplateVariable (Optional)

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
- Scenario → AvatarTransitionRules (1:N)
- Scenario → PromptTemplateVariables (1:N, optional)

---

# What Lives in JSONB

Use JSONB when structure may evolve quickly:

- scenario config
- avatar config
- message metadata
- source metadata
- event payloads
- transition rule config
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
- event_logs(session_id, created_at)

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
