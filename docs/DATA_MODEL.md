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
- slug
- status (draft / active / archived)
- config (JSONB)
- created_at
- updated_at

### Typical Config

- world context
- objectives
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
- slug
- status (draft / active / archived)
- description (nullable)
- tone (nullable)
- persona_prompt
- config (JSONB)
- created_at
- updated_at

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

---

## 4. Session

Represents one conversation instance.

### Fields

- id
- user_id
- scenario_id
- status (active / closed / archived)
- started_at
- last_activity_at
- ended_at (nullable)

### Notes

One session = one conversation timeline.

A Session is the equivalent of one run of the experience.

Using the movie analogy:

- Scenario = the production setup
- Avatar = an actor in that production
- Session = one concrete movie/playthrough

---

## 5. Message

Represents one message in a session.

### Fields

- id
- session_id
- role (user / avatar / system)
- content
- created_at

### Optional

- avatar_id (nullable)
- metadata (JSONB)

### Metadata Examples

- model used
- latency_ms
- token counts
- trigger source
- stream stats

### Notes

Use one table for all messages.

`avatar_id` is nullable because:

- user messages have no avatar
- some system messages may not belong to a specific avatar
- avatar messages should reference the speaking avatar

This prepares the model for multi-avatar sessions without needing separate message tables.

Avoid separate Exchange tables unless clearly needed later.

---

## 6. SessionMemory

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

## 7. AvatarSessionMemory

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

## 8. UserMemoryFact

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

## 9. KnowledgeSource

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

## 10. KnowledgeChunk

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

## 11. EventLog

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

## 12. IngestionJob

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

## 13. AdminActionLog

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

# Relationships

- User → Sessions (1:N)
- User → UserMemoryFacts (1:N)
- Scenario → Avatars (1:N)
- Scenario → Sessions (1:N)
- Scenario → KnowledgeSources (1:N)
- Session → Messages (1:N)
- Session → SessionMemory (1:1)
- Session → AvatarSessionMemories (1:N)
- Avatar → Messages (1:N, nullable on Message side)
- Avatar → AvatarSessionMemories (1:N)
- KnowledgeSource → KnowledgeChunks (1:N)
- KnowledgeSource → IngestionJobs (1:N)
- Session → EventLogs (1:N)

---

# What Lives in JSONB

Use JSONB when structure may evolve quickly:

- scenario config
- avatar config
- message metadata
- source metadata
- event payloads

Do **not** hide core relational data inside JSONB.

In particular, do not hide:

- avatar ownership
- session ownership
- message/session relations
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
- avatars(scenario_id, status)
- avatars(scenario_id, slug)
- messages(session_id, created_at)
- messages(session_id, avatar_id, created_at)
- avatar_session_memories(session_id, avatar_id)
- user_memory_facts(user_id, category)
- knowledge_sources(scenario_id)
- knowledge_chunks(source_id)
- event_logs(session_id, created_at)

Add unique indexes where relevant:

- scenarios(slug)
- avatars(scenario_id, slug)
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
