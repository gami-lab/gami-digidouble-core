# Data Model

## Purpose

Compact reference for the Phase A persisted model.

This document records:

- persisted entities
- key fields
- important relationships
- reset boundaries

Runtime behavior belongs in `MEMORY_SYSTEM_SPEC.md` and `GAME_MASTER_CONTRACT.md`.

## Scope Rules

- Only document persisted entities that exist in the current implementation.
- Derived runtime artifacts such as `contextTrace` are not database entities.
- This file describes persistence, not HTTP DTO ownership.

## Persisted Entities

### Core Runtime

| Table           | Purpose                                                | Key fields                                                                                                                              | Notes                                                                                                                         |
| --------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `users`         | Stable user identity plus optional persona             | `id`, `persona`, `created_at`, `updated_at`                                                                                             | Persona matches canonical `UserPersona` and is injected into runtime context, not copied into sessions or messages.           |
| `scenarios`     | Top-level experience configuration                     | `id`, `name`, `status`, `objectives`, `world_context`, `avatar_availability`, `config`, `model_selection`, timestamps                   | Owns avatars, sessions, and knowledge sources.                                                                                |
| `avatars`       | One actor inside a scenario                            | `id`, `scenario_id`, `name`, `status`, `persona_prompt`, `tone`, `description`, `adjustments`, `computed_traits`, `config`, timestamps  | `computed_traits` stores the EPIC 8.1 seven-field trait structure. `config.llmOverride` stores the per-avatar model override. |
| `sessions`      | Durable user run container for one scenario            | `id`, `user_id`, `scenario_id`, `active_avatar_id`, `unlocked_avatar_ids`, `gm_notes`, `memory_summary`, `status`, lifecycle timestamps | `memory_summary` is a compatibility mirror, not canonical working memory.                                                     |
| `conversations` | One bounded dialogue episode inside a session          | `id`, `session_id`, `avatar_id`, `status`, `started_by`, `reason`, `handoff_from_conversation_id`, lifecycle timestamps                 | Avatar switches create new conversations. Closure is the episodic-memory boundary.                                            |
| `messages`      | Persisted conversation messages                        | `id`, `conversation_id`, `role`, `content`, `metadata`, `created_at`                                                                    | `metadata` stores model, latency, token, and related observability fields.                                                    |
| `gm_states`     | Lightweight persisted Game Master state                | `session_id`, `current_avatar_id`, `progression`, `topics_covered`, `interaction_count`, `updated_at`                                   | One row per session.                                                                                                          |
| `event_log`     | Persisted runtime diagnostics and observability events | `id`, `session_id`, `type`, `severity`, `correlation_id`, `request_id`, `payload`, `created_at`                                         | Must stay free of raw prompts, secrets, and unbounded transcript payloads.                                                    |
| `model_config`  | Single-row runtime model routing config                | `id`, `config`, `updated_at`                                                                                                            | `id` is constrained to one active row. Stores global default plus role overrides.                                             |

Streaming does not change the data model: it is transport-only. The user message is saved before
deltas, and a partial avatar message is never saved.

### Memory

| Table                           | Purpose                                             | Key fields                                                                                                                                                 | Notes                                                        |
| ------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `session_memories`              | Compact session-level memory summary                | `session_id`, `summary`, `updated_at`                                                                                                                      | Session-scoped continuity layer.                             |
| `conversation_working_memories` | Canonical active-conversation working memory        | `conversation_id`, `session_id`, `avatar_id`, `summary`, `unresolved_threads`, `covered_topics`, `candidate_facts`, `updated_at`                           | `covered_topics` is first-class state.                       |
| `avatar_session_memories`       | Avatar-scoped session continuity                    | `session_id`, `avatar_id`, `summary`, `updated_at`                                                                                                         | One row per `(session_id, avatar_id)`.                       |
| `conversation_memories`         | Long-term episodic memory from closed conversations | `conversation_id`, `session_id`, `user_id`, `avatar_id`, `scenario_id`, `summary`, `key_discoveries`, `unresolved_topics`, `fact_candidates`, `created_at` | Retrieval scope is intentionally `user + avatar + scenario`. |
| `user_memory_facts`             | Stable structured user facts                        | `id`, `user_id`, `category`, `key`, `value`, `confidence`, `updated_at`                                                                                    | Stores facts, not transcripts.                               |

### Knowledge

| Table               | Purpose                                         | Key fields                                                                                                                                               | Notes                                                                                                    |
| ------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------- | -------------------------------- |
| `knowledge_sources` | Scenario-scoped knowledge assets                | `id`, `scenario_id`, `name`, `knowledge_type`, `format`, `uri_or_path`, `status`, `metadata`, `visible_to_avatar_ids`, `visibility_policy`, `created_at` | Visibility policies are `'all'                                                                           | 'avatars' | 'none'`; `'none'` means GM-only. |
| `knowledge_chunks`  | Retrieval chunks derived from knowledge sources | `id`, `source_id`, `content`, `chunk_index`, `embedding`, `metadata`, `visible_to_avatar_ids`, `created_at`                                              | Stored in PostgreSQL with pgvector embeddings. Chunk visibility usually inherits from source visibility. |
| `ingestion_jobs`    | Knowledge ingestion lifecycle tracking          | `id`, `source_id`, `status`, `attempts`, `started_at`, `completed_at`, `error_message`, `created_at`, `updated_at`                                       | Tracks queued/running/completed/failed ingestion work.                                                   |

## Relationships

- `users` -> `sessions` (1:N)
- `users` -> `user_memory_facts` (1:N)
- `scenarios` -> `avatars` (1:N)
- `scenarios` -> `sessions` (1:N)
- `scenarios` -> `knowledge_sources` (1:N)
- `sessions` -> `conversations` (1:N)
- `sessions` -> `gm_states` (1:1)
- `sessions` -> `session_memories` (1:1)
- `sessions` -> `avatar_session_memories` (1:N)
- `sessions` -> `event_log` (1:N)
- `conversations` -> `messages` (1:N)
- `conversations` -> `conversation_working_memories` (1:1)
- `conversations` -> `conversation_memories` (1:1 after close)
- `knowledge_sources` -> `knowledge_chunks` (1:N)
- `knowledge_sources` -> `ingestion_jobs` (1:N)

## Reset Boundaries

- Session reset clears session-scoped runtime state, messages, and active memory layers for that session.
- User facts are long-lived and are not part of normal session reset.
- Episodic memories are not the same as active working memory and should not be treated as session scratch state.

## JSONB Rules

- Use JSONB for bounded structured payloads that are genuinely flexible.
- Do not use JSONB as a substitute for stable top-level fields already owned by canonical contracts.
- Keep persistence and shared DTO ownership aligned when contracts evolve.

## Not In Scope

- Audit-log tables not backed by current implementation
- Prompt-template-variable tables not backed by current implementation
- Persisted context-engine traces
- Raw transcript-as-memory storage
