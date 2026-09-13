# Data model

This is the durable ownership map for the current clean-slate schema. Exact columns, constraints,
and JSON shapes are defined by `infra/postgres/init.sql` and the repository types.

## Scope rules

- PostgreSQL is the system of record; Redis holds cache/coordination state, not durable conversation truth.
- Public DTOs are projections, never persistence rows.
- Static knowledge is scenario-scoped. Conversational memory is user/session/conversation-scoped.
- Raw prompts, provider payloads, raw audio, and embedding vectors are not public inspection data.
- The current Phase A deployment assumes a fresh canonical database schema; there is no runtime schema migration layer.

## Persisted aggregates

| Aggregate                | Owns                                                                     | Boundary                                                                   |
| ------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| User                     | identity, persona, long-term facts                                       | User facts are managed separately from static knowledge.                   |
| Scenario                 | language, authored configuration, enabled Avatars, model selection       | Defines an experience; does not own conversation history.                  |
| Avatar                   | persona, prompt sections, prepared traits, optional voice/model override | Must be prepared before activation/serving.                                |
| Session                  | user/scenario membership, active Avatar, runtime state, exchange count   | Reset is a session operation.                                              |
| Conversation             | one bounded Avatar episode and lifecycle                                 | Close/switch boundaries trigger memory work.                               |
| Message                  | user/avatar/system content and safe metadata                             | Final Avatar text is the source for optional audio.                        |
| Game Master state/events | current orchestration state and bounded runtime diagnostics              | GM state is current-shape-only; events are append-only inspection records. |
| Memory                   | working, episodic, and long-term fact layers                             | Each layer has an explicit owner and lifecycle.                            |
| Knowledge source/chunk   | scenario-shared content, visibility, ingestion state, corpus identity    | Types are `avatar_knowledge`, `world`, `media`.                            |
| Embedding profile/corpus | immutable vector profile, generations, reindex progress, active pointer  | Promotion is complete and atomic.                                          |
| Model configuration      | global/role/scenario/avatar model choices                                | Values must come from the shared catalog.                                  |

## Relationships

`User -> Sessions -> Scenario`; `Scenario -> Avatars and Knowledge Sources`; `Session ->
Conversations -> Messages`; `Conversation -> working/episodic memory`; `User -> persona/facts`;
`Knowledge Source -> Chunks -> active Corpus Generation`.

Knowledge visibility is source-owned and inherited by chunks. It is not an Avatar-to-source join
table and does not create conversational memory.

## Reset and lifecycle ownership

- Session reset owns active runtime cleanup and the reset boundary.
- Conversation close owns compaction of conversation working/episodic memory.
- Memory maintenance owns summaries, covered topics, unresolved threads, candidate facts, and fact promotion.
- Static ingestion/reindex owns source/chunk replacement and vector corpus promotion.
- Scenario/avatar deletion owns its configured cascade.
- No whole-user deletion aggregate is part of the current Phase A API; user-fact deletion and session reset are the implemented user-scoped operations.

## JSONB rules

- JSONB is for bounded, owned configuration/projection data, not an undocumented second schema.
- Validate and normalize at the API/application boundary.
- Do not store provider credentials, raw prompts, raw audio, or user/session/conversation scope in static knowledge metadata.
- Add a new persisted field only with an owner, lifecycle, public projection decision, and tests.

## Not persisted

- audio bytes generated for playback
- provider request/response payloads
- transient query vectors and raw retrieval distance
- partial streamed Avatar responses
- historical compatibility mirrors removed by the clean-slate contract
