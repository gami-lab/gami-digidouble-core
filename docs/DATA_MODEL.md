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

- avatar prompt/persona
- world context
- objectives
- enabled features
- source references
- UI hints

### Notes

Scenario config is data, not code.

---

## 3. Session

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

---

## 4. Message

Represents one message in a session.

### Fields

- id
- session_id
- role (user / avatar / system)
- content
- created_at

### Optional

- metadata (JSONB)

### Metadata Examples

- model used
- latency_ms
- token counts
- trigger source
- stream stats

### Notes

Use one table for all messages.  
Avoid separate Exchange tables unless clearly needed later.

---

## 5. SessionMemory

Compact working memory for an active session.

### Fields

- session_id
- summary
- updated_at

### Notes

Recent raw messages come from Message table.  
This table stores only compacted memory.

---

## 6. UserMemoryFact

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

---

## 7. KnowledgeSource

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

---

## 8. KnowledgeChunk

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

## 9. EventLog

Operational events useful for debugging and metrics.

### Fields

- id
- session_id (nullable)
- type
- payload (JSONB)
- created_at

### Examples

- gm_triggered
- retrieval_used
- llm_error
- fallback_used
- session_started

### Notes

Use only events that are actually useful.

---

# Relationships

- User → Sessions (1:N)
- User → UserMemoryFacts (1:N)
- Scenario → Sessions (1:N)
- Scenario → KnowledgeSources (1:N)
- Session → Messages (1:N)
- Session → SessionMemory (1:1)
- KnowledgeSource → KnowledgeChunks (1:N)
- Session → EventLogs (1:N)

---

# What Lives in JSONB

Use JSONB when structure may evolve quickly:

- scenario config
- message metadata
- source metadata
- event payloads

Do **not** hide core relational data inside JSONB.

---

# What We Intentionally Avoid (For Now)

- separate Avatar table
- separate Storyworld table
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
- session events

Keeps:

- user
- scenario
- user memory facts

## Reset User

Deletes:

- sessions
- user memory facts
- related logs

---

# Suggested Indexes (Minimal)

- sessions(user_id, last_activity_at)
- messages(session_id, created_at)
- user_memory_facts(user_id, category)
- knowledge_sources(scenario_id)
- knowledge_chunks(source_id)
- event_logs(session_id, created_at)

Vector index added when chunk volume justifies it.

---

# Evolution Path (Later)

Introduce only when needed:

- Avatar table (shared personas)
- Node / graph runtime state
- Multi-avatar sessions
- Tenant isolation
- Evaluation results tables
- Billing / quotas
- Dedicated analytics store

---

# Final Rule

If data is not used by product logic, operations, or learning:

**do not store it**