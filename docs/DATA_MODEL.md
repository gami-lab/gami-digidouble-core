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

| Table           | Purpose                                                | Key fields                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`         | Stable user identity plus optional persona             | `id`, `persona`, `created_at`, `updated_at`                                                                                                                                 | Persona matches canonical `UserPersona` and is injected into runtime context, not copied into sessions or messages.                                                                                                                                                             |
| `scenarios`     | Top-level experience configuration                     | `id`, `name`, `status`, `objectives`, `world_context`, `avatar_availability`, `config`, `model_selection`, timestamps                                                       | Owns avatars, sessions, and knowledge sources.                                                                                                                                                                                                                                  |
| `avatars`       | One actor inside a scenario                            | `id`, `scenario_id`, `name`, `status`, `persona_prompt`, `tone`, `description`, `adjustments`, `computed_traits`, `config`, timestamps                                      | `computed_traits` stores the EPIC 8.1 seven-field trait structure. `config.llmOverride` stores the per-avatar model override.                                                                                                                                                   |
| `sessions`      | Durable user run container for one scenario            | `id`, `user_id`, `scenario_id`, `active_avatar_id`, `unlocked_avatar_ids`, `model_override`, `avatar_options`, `gm_notes`, `memory_summary`, `status`, lifecycle timestamps | `model_override` is an optional session-scoped runtime model selection shared by Avatar, Game Master, and memory compaction. `avatar_options` stores session-scoped Avatar retrieval experiments. `memory_summary` is a compatibility mirror, not canonical working memory.     |
| `conversations` | One bounded dialogue episode inside a session          | `id`, `session_id`, `avatar_id`, `status`, `started_by`, `reason`, `handoff_from_conversation_id`, lifecycle timestamps                                                     | Avatar switches create new conversations. Closure is the episodic-memory boundary.                                                                                                                                                                                              |
| `messages`      | Persisted conversation messages                        | `id`, `conversation_id`, `role`, `content`, `metadata`, `created_at`                                                                                                        | `metadata` stores model, latency, token, and related observability fields.                                                                                                                                                                                                      |
| `gm_states`     | Lightweight persisted Game Master state                | `session_id`, `progression`, `interaction_count`, `next_turn_orchestration`, `updated_at`                                                                                   | One row per session. The session owns the active Avatar and memory compaction owns covered topics; legacy `current_avatar_id` and `topics_covered` columns may remain during migration, are read only for compatibility, and are omitted from current shared/admin projections. |
| `event_log`     | Persisted runtime diagnostics and observability events | `id`, `session_id`, `type`, `severity`, `correlation_id`, `request_id`, `payload`, `created_at`                                                                             | Must stay free of raw prompts, secrets, and unbounded transcript payloads.                                                                                                                                                                                                      |
| `model_config`  | Single-row runtime model routing config                | `id`, `config`, `updated_at`                                                                                                                                                | `id` is constrained to one active row. Stores global default plus role overrides.                                                                                                                                                                                               |

Retrieval trace/profile diagnostics are additive safe payload projections; this slice does not add
or change a persisted table or vector schema. If later runtime events persist retrieval traces,
they must use the shared bounded DTO fields and retain the active embedding profile/generation
identity without persisting raw vectors.

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

### Memory Field Semantics

- The three most recent complete exchanges are derived at runtime from `messages`; they are not
  persisted in a separate short-term table.
- `conversation_working_memories` is the canonical mutable state for an active conversation. Its
  `summary`, `covered_topics`, `unresolved_threads`, and `candidate_facts` are rewritten and
  upserted on refresh; they are not append-only transcript fragments.
- `covered_topics` records subjects already discussed. `unresolved_threads` records only active
  loose ends. A thread is resolved by disappearing from the next rewritten list; no extra status
  column is required.
- `candidate_facts` are compacted, grounded candidates. They are not equivalent to a durable
  `user_memory_facts` row and must not be treated as inferred mood, trust, pacing, or progression.
- `conversation_memories` is immutable episodic output created at conversation close and is used
  for bounded hydration/selection in later conversations.
- `user_memory_facts` is user-scoped, deduplicated, and injected into prompts only through bounded
  context assembly. It survives normal session reset.

### Knowledge

| Table | Purpose | Key fields | Notes |
| ------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------- | -------------------------------- |
| `knowledge_sources` | Scenario-scoped knowledge assets | `id`, `scenario_id`, `name`, `knowledge_type`, `format`, `uri_or_path`, `status`, `metadata`, `visible_to_avatar_ids`, `visibility_policy`, `created_at` | Visibility policies are `'all'                                                                           | 'avatars' | 'none'`; `'none'` means GM-only. |
| `knowledge_source_quarantines` | Blocked legacy static knowledge classification | `source_id`, `original_knowledge_type`, `classification`, `reason`, `offending_key_names`, `quarantined_at` | One row per ambiguous legacy source; blocked sources are excluded from retrieval. |
| `embedding_profiles` | Immutable provider/model/dimension identity for one vector space | `id`, `provider`, `model`, `dimensions`, `created_at` | Unique on `(provider, model, dimensions)`. Internal persistence state; not a public DTO. |
| `corpus_generations` | Immutable staged or active replacement corpus | `id`, `embedding_profile_id`, `status`, `expected_source_count`, lifecycle timestamps | A generation belongs to exactly one profile. Status is `staging`, `validated`, `active`, `superseded`, or `failed`. |
| `knowledge_corpus_state` | Atomic active-corpus pointer | `id=1`, `active_generation_id`, `active_profile_id` | Singleton database-owned pointer. Normal reads use this pair and never expose staged generations. |
| `knowledge_chunks` | Retrieval chunks derived from knowledge sources | `id`, `source_id`, `content`, `chunk_index`, `embedding`, `embedding_profile_id`, `corpus_generation_id`, `metadata`, `visible_to_avatar_ids`, `created_at` | Vectorized chunks must carry both immutable identities. New or updated metadata cannot recursively contain `userId`, `sessionId`, or `conversationId`. The fixed column is `VECTOR(16)` and uses `vector_cosine_ops`; old unprofiled vectors are nulled during schema alignment while source content remains. Chunks are unique per `(source_id, corpus_generation_id, chunk_index)`, so replacement generations can stage the same source/index independently. Normal ingestion replaces only the source's rows in the active generation inside one transaction. |
| `reindex_operations` | Replacement corpus lifecycle tracking | `id`, `corpus_generation_id`, `embedding_profile_id`, expected active profile/generation, `status`, `attempts`, source counts, timestamps, bounded `failure_details` | Tracks `pending`, `running`, `completed`, and `failed` operations. The expected active pair is a promotion compare-and-set guard. |
| `reindex_operation_sources` | Per-operation source progress | `reindex_operation_id`, `source_id`, `status`, `attempts`, chunk counts, timestamps, bounded `failure_details` | Unique per operation/source and idempotently replaceable. |
| `corpus_generation_sources` | Per-generation completeness ledger | `corpus_generation_id`, `source_id`, `status`, expected/completed chunk counts | Promotion requires every expected source to complete and all staged vectors to be non-null. |
| `ingestion_jobs` | Knowledge ingestion lifecycle tracking | `id`, `source_id`, `status`, `attempts`, `chunk_size`, `started_at`, `completed_at`, `error_message`, `created_at`, `updated_at` | Tracks queued/running/completed/failed ingestion work. Full-corpus replacement is owned by reindex operations, not this per-source job. |

Core Application owns the provider-neutral `EmbeddingProfile` and reindex-operation contracts.
Infrastructure maps them to the internal PostgreSQL profile, generation, active-pointer, and
progress tables. The current public source/chunk/ingestion-job DTOs remain unchanged. The
authenticated operator routes expose additive shared projections for profile and operation/source
status; those DTOs do not mirror persistence rows or include vectors/content.

`knowledge_corpus_state` is the canonical owner of the active profile/generation identity.
`knowledge_chunks` are immutable members of a generation and must have a finite vector matching
that generation's profile. A source becomes `ready` only after its complete replacement commits
against the active pointer; failed or stale work leaves a prior ready source unchanged, or keeps a
source unavailable when no valid active vectors exist. Reindex operation and source-progress
lifecycle types are internal Application contracts owned by Core; only the bounded operator
projection is shared for the admin API.

Nearest-neighbor retrieval applies the active profile/generation, ready-source, scenario/type,
and visibility filters in SQL before limiting candidates. Pgvector cosine distance
is lower-is-better; service/API similarity is exactly `1 - distance`, with clamping and rounding
owned only by presenters. A query with the wrong dimension or stale profile/generation is rejected
before search, and rows outside the active profile/generation are ineligible before the candidate
limit. Search candidates do not select or persist the embedding column.

### Static knowledge terminology and migration invariant

The legacy `knowledge_sources.knowledge_type = 'memory'` value is audited before the terminology
rename in EPIC 4.2d. The checked-in dry-run tool (`scripts/audit-legacy-knowledge-memory.ts`) scans
source and chunk JSON metadata recursively for the reserved scope keys `userId`, `sessionId`, and
`conversationId`. It reports source/chunk IDs, current type, visibility, offending key names, and a
proposed classification without selecting content or vectors and without mutating rows. The
canonical `knowledge_sources.knowledge_type` values are `avatar_knowledge`, `world`, and
`media`; the PostgreSQL check constraint rejects `memory`. The migration tool
(`scripts/migrate-legacy-knowledge-memory.ts`) changes only positively classified rows.
Ambiguous rows are set to `blocked` and recorded in `knowledge_source_quarantines`, preserving the
legacy type, classification, reason, and offending key names without making them retrievable.
New or updated source/chunk metadata rejects those reserved keys. No static document is converted
into conversational memory. During rollout, schema alignment temporarily defers re-adding the
canonical type check if legacy `memory` rows still exist; `--apply` completes the data migration
and restores the check in the same transaction.

Static retrieval has no user, session, or conversation scope. The only retrieval visibility inputs
are scenario, canonical knowledge type, active corpus identity, Avatar visibility, and the explicit
Game Master visibility bypass. Session reset, conversation close, user-fact deletion, and memory
maintenance cannot mutate knowledge sources, chunks, embeddings, or corpus generations. Scenario
deletion owns scenario knowledge removal through the existing scenario foreign-key cascade; static
reindex owns only knowledge corpus rows.

The final EPIC 4.2d boundary proof is recorded in
[EPIC_4_2D_REQUIREMENTS_MATRIX.md](EPIC_4_2D_REQUIREMENTS_MATRIX.md): scenario deletion cascades
owned sources/chunks, while conversation/session memory remains outside that cascade. The full
user-deletion aggregate is not exposed by the current Phase A API; existing user-scoped fact
deletion and session reset paths are the implemented ownership boundaries.

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
- `embedding_profiles` -> `corpus_generations` (1:N)
- `corpus_generations` -> `knowledge_chunks` (1:N)
- `corpus_generations` -> `corpus_generation_sources` (1:N)
- `reindex_operations` -> `reindex_operation_sources` (1:N)

## Reset Boundaries

- Session reset clears session-scoped runtime state, messages, and active memory layers for that session.
- User facts are long-lived and are not part of normal session reset.
- Episodic memories are not the same as active working memory and should not be treated as session scratch state.

## JSONB Rules

- Use JSONB for bounded structured payloads that are genuinely flexible.
- Do not use JSONB as a substitute for stable top-level fields already owned by canonical contracts.
- Keep persistence and shared DTO ownership aligned when contracts evolve.
- Future voice configuration may use the existing bounded Avatar/Scenario configuration mechanism,
  but its reserved shape must be validated through the canonical shared voice contract. Audio bytes
  and delivery metadata are transient and are not persisted with messages by default.

## Not In Scope

- Audit-log tables not backed by current implementation
- Prompt-template-variable tables not backed by current implementation
- Persisted context-engine traces
- Raw transcript-as-memory storage
