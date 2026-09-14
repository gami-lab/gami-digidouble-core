# Data model

This is the durable ownership map for the current clean-slate schema. Exact columns, constraints,
and JSON shapes are defined by `infra/postgres/init.sql` and the repository types.

## Scope rules

- PostgreSQL is the system of record; Redis holds cache/coordination state, not durable conversation truth.
- Public DTOs are projections, never persistence rows.
- Static knowledge is scenario-scoped. Conversational memory is user/session/conversation-scoped.
- Raw prompts, provider payloads, raw audio, and embedding vectors are not public inspection data.
- The current Phase A deployment assumes a fresh canonical database schema; there is no runtime schema migration layer. Every deploy wipes and recreates the database, so schema/column changes never need a migration path or backward-compatible shape — edit `infra/postgres/init.sql` and the repository types directly.

## Persisted aggregates

| Aggregate                | Owns                                                                     | Boundary                                                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User                     | identity, persona, long-term facts                                       | User facts are managed separately from static knowledge.                                                                                                                                                                                                                                              |
| Scenario                 | language, authored configuration, enabled Avatars, model selection       | Defines an experience; does not own conversation history.                                                                                                                                                                                                                                             |
| Avatar                   | persona, prompt sections, prepared traits, optional voice/model override | Must be prepared before activation/serving.                                                                                                                                                                                                                                                           |
| Session                  | user/scenario membership, active Avatar, runtime state, exchange count   | Reset is a session operation.                                                                                                                                                                                                                                                                         |
| Conversation             | one bounded Avatar episode and lifecycle                                 | Close/switch boundaries trigger memory work.                                                                                                                                                                                                                                                          |
| Message                  | user/avatar/system content and safe metadata                             | Final Avatar text is the source for optional audio.                                                                                                                                                                                                                                                   |
| Game Master state/events | current orchestration state and bounded runtime diagnostics              | `gm_states` is one row per session (current-shape-only, no history); the session owns the active Avatar and memory owns covered topics, so GM state has no separate active-avatar or topic columns. `event_log` is append-only and must stay free of raw prompts, secrets, and unbounded transcripts. |
| Memory                   | working, episodic, and long-term fact layers                             | Each layer has an explicit owner and lifecycle.                                                                                                                                                                                                                                                       |
| Knowledge source/chunk   | scenario-shared content, visibility, ingestion state, corpus identity    | Types are `avatar_knowledge`, `world`, `media`.                                                                                                                                                                                                                                                       |
| Embedding profile/corpus | immutable vector profile, generations, reindex progress, active pointer  | Promotion is complete and atomic.                                                                                                                                                                                                                                                                     |
| Model configuration      | global/role/scenario/avatar model choices                                | `model_config` is a single-row table (one active row); values must come from the shared catalog.                                                                                                                                                                                                      |

## Relationships

`User -> Sessions -> Scenario`; `Scenario -> Avatars and Knowledge Sources`; `Session ->
Conversations -> Messages`; `Conversation -> working/episodic memory`; `User -> persona/facts`;
`Knowledge Source -> Chunks -> active Corpus Generation`. `Session -> gm_states` and `Session ->
session_memories` are 1:1; `Embedding Profile -> Corpus Generations -> Chunks` is 1:N.

Knowledge visibility is source-owned and inherited by chunks. It is not an Avatar-to-source join
table and does not create conversational memory.

## Memory layer semantics

- The short-term window (last 3 complete exchanges) is derived at runtime from `messages`; it has
  no dedicated table.
- Conversation working memory is the canonical mutable state for an active conversation: its
  summary, `covered_topics`, `unresolved_threads`, and `candidate_facts` are rewritten/upserted on
  each refresh, not appended. A thread is "resolved" simply by being absent from the next rewrite —
  there is no separate status column. `candidate_facts` are compacted and grounded but are not
  durable `user_memory_facts` rows, and must not be treated as inferred mood/trust/pacing state.
- Episodic memory (`conversation_memories`) is immutable, created once at conversation close, and
  is retrieved for hydration scoped to `user + avatar + scenario` — intentionally narrower than
  global user history.
- `user_memory_facts` is user-scoped, deduplicated, survives normal session reset, and is injected
  into prompts only through bounded context assembly — never as raw transcript.
- Working-memory compaction rejects Avatar claims that are unsupported or contradicted before they
  can become memory (see `ARCHITECTURE.md` Memory module).

## Knowledge versioning (embeddings)

Vector identity is versioned so an embedding model/dimension change is a safe, staged operation
rather than a silent corruption risk:

- `embedding_profiles` is an immutable `(provider, model, dimensions)` identity.
- `corpus_generations` is an immutable staged-or-active replacement corpus, `status` one of
  `staging | validated | active | superseded | failed`, belonging to exactly one profile.
- `knowledge_corpus_state` is a **singleton** row (`id=1`) pointing at the current active
  generation/profile pair; normal reads always go through this pointer and never see staged
  generations.
- Every `knowledge_chunks` row carries both its source's identity and its generation/profile
  identity, and must have a finite vector matching that generation's profile — chunks are unique
  per `(source_id, corpus_generation_id, chunk_index)` so a staged generation can reprocess a
  source independently of the active one.
- `knowledge_chunks.content_hash` stores a SHA-256 hash of the final persisted chunk text. Reindex
  compares it at the same source and chunk index only when the target profile is the active profile;
  copied vectors are still persisted under the new generation/profile identity. Profile changes do
  not reuse hashes across vector spaces.
- `reindex_operations`/`reindex_operation_sources`/`corpus_generation_sources` track full-corpus
  rebuild progress per source. `reindex_operation_sources` also records bounded embedded-versus-
  reused chunk counts for operator support; promotion is a single transaction that locks and swaps
  the active pointer only after every expected source is complete, then marks the previous
  generation `superseded` — so a failed or partial rebuild always leaves the previous active corpus
  queryable.
- The deployed column is fixed at `VECTOR(1536)` with `vector_cosine_ops`. Changing dimensions
  requires a new canonical schema revision plus a full staged reindex; existing DB volumes are not
  reusable across that change, and config alone cannot select a mixed vector space.
- Nearest-neighbor search applies active profile/generation, source-readiness, scenario/type, and
  visibility filters in SQL before `LIMIT`; it never selects or persists the embedding column into
  a result. Repository cosine distance is lower-is-better; public similarity is `1 - distance`.
- `knowledge_chunks` also has an expression GIN index on `to_tsvector('simple', content)` for the
  bounded lexical candidate path. Lexical search applies the same active profile/generation,
  source-readiness, scenario/type, and visibility filters and never replaces vector identity checks.

## Static knowledge contract

- Canonical `knowledge_sources.knowledge_type` values are exactly `avatar_knowledge`, `world`, and
  `media`, enforced both by API validation and a PostgreSQL check constraint.
- Static source/chunk metadata is validated recursively (see
  `apps/core/src/domain/knowledge/static-knowledge-validation.ts`); the reserved keys `userId`,
  `sessionId`, `conversationId` are always invalid there because static knowledge is scenario-scoped
  and must never be convertible into conversational memory.
- Static retrieval's only visibility inputs are scenario, type, active corpus identity, Avatar
  visibility, and the explicit GM unrestricted bypass — never user/session/conversation scope.

## Reset and lifecycle ownership

- Session reset owns active runtime cleanup and the reset boundary.
- Conversation close owns compaction of conversation working/episodic memory.
- Memory maintenance owns summaries, covered topics, unresolved threads, candidate facts, and fact promotion.
- Static ingestion/reindex owns source/chunk replacement and vector corpus promotion. Session
  reset, conversation close, and user-fact deletion never mutate knowledge sources, chunks,
  embeddings, or corpus generations, and reindex never touches conversational memory rows.
- Scenario deletion cascades its own sources/chunks via a foreign-key cascade; this is a distinct
  path from conversation/session memory cleanup, which stays outside that cascade.
- No whole-user deletion aggregate is part of the current Phase A API; user-fact deletion and session reset are the implemented user-scoped operations.

## JSONB rules

- JSONB is for bounded, owned configuration/projection data, not an undocumented second schema.
- Validate and normalize at the API/application boundary.
- Do not store provider credentials, raw prompts, raw audio, or user/session/conversation scope in static knowledge metadata.
- Add a new persisted field only with an owner, lifecycle, public projection decision, and tests.
- Voice configuration reuses the existing Avatar/Scenario `config` JSONB under a reserved
  `voiceConfig` key rather than a new column; rows without the key simply project as "no voice
  configured." Model overrides (`avatar.config.llmOverride`, `session.model_override`) follow the
  same pattern: reserved JSONB keys projected into typed fields, not new top-level columns.

## Gotchas

- Streaming is transport-only and does not change persistence: the user message is saved before
  deltas are sent, and a partial Avatar message is never saved on interruption.
- Retrieval trace/profile diagnostics returned over the API are computed, additive projections —
  they are not currently a persisted table. If a future event type persists a retrieval trace, it
  must reuse the shared bounded DTO fields and keep the profile/generation identity without ever
  persisting raw vectors.
- `contextTrace` and other Context Engine kept/trimmed diagnostics are derived per-request, not
  database entities — do not add a table for them without a concrete replay requirement.

## Not persisted

- audio bytes generated for playback
- provider request/response payloads
- transient query vectors and raw retrieval distance
- partial streamed Avatar responses
- historical compatibility mirrors removed by the clean-slate contract
