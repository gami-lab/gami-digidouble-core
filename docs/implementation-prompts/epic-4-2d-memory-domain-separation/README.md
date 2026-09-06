# EPIC 4.2d — Memory Domain Separation

## Objective

Make the boundary between scenario-owned static knowledge and user-bound conversational memory
explicit and enforceable. Static `avatar_knowledge`, `world`, and `media` sources remain shared,
scenario-scoped RAG inputs; short-term, working, episodic, and long-term user memory remain bounded
conversation-lifecycle state and never become knowledge chunks or vectors.

## Generated

2026-09-06

## Ordered Execution List

| #   | File                                               | Purpose                                                                                                                      |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 0   | `00-contract-and-data-audit.md`                    | Establish canonical ownership and classify legacy `memory` sources before changing contracts.                                |
| 1   | `01-static-knowledge-terminology-and-migration.md` | Replace static `memory` with `avatar_knowledge` across contracts, persistence, validation, and migration tooling.            |
| 2   | `02-shared-rag-scope-and-lifecycle-boundaries.md`  | Remove user/session/conversation RAG scoping and enforce independent reset, deletion, ingestion, and maintenance lifecycles. |
| 3   | `03-context-projections-and-runtime-wiring.md`     | Separate Conversation State from Retrieved Context for Avatar and unrestricted GM projections.                               |
| 4   | `04-admin-inspection-and-diagnostics.md`           | Make static knowledge and each conversational-memory layer structurally distinct to operators.                               |
| 5   | `05-isolation-tests-hardening-and-doc-sync.md`     | Prove isolation/consistency invariants, close regressions, and synchronize all source-of-truth docs.                         |

## Dependencies Between Prompts

- `00` is mandatory first because `KnowledgeType`, typed retrieval results, context snapshots, admin
  DTOs, persistence rows, and local UI/test mirrors already have a wide blast radius.
- `01` depends on the ownership and legacy-data inventory from `00`. Its migration must classify
  legacy rows before later slices remove their ambiguous behavior.
- `02` depends on canonical `avatar_knowledge` semantics from `01` and establishes the lifecycle
  invariants on which runtime projection work relies.
- `03` depends on `01` and `02`; it must consume the final typed retrieval contract rather than add
  compatibility branches throughout prompt assembly.
- `04` depends on the final runtime and DTO projections from `03` so operator surfaces do not invent
  a parallel taxonomy.
- `05` runs last and verifies the complete cross-user, lifecycle, prompt, migration, and operator story.

## Suggested Execution Order

`00 -> 01 -> 02 -> 03 -> 04 -> 05`

Do not parallelize `00` through `03`: each changes or constrains high-fanout contracts. Prompt `04`
may begin only after the shared inspection DTOs in `03` are stable. Prompt `05` is the final closure
gate, not a place to defer tests that belong with earlier behavior.

## Definition Of Done For Full EPIC

- [ ] Static `KnowledgeType` is canonically `avatar_knowledge | world | media`; runtime and output contracts never call static documents memory.
- [ ] If legacy input alias `memory` is retained temporarily, it is accepted only at a documented API migration boundary, normalized immediately to `avatar_knowledge`, never emitted, and has a removal plan.
- [ ] Every static source is scenario-owned, shared across users, and optionally restricted only by Avatar visibility; source/chunk metadata cannot create user, session, or conversation scope.
- [ ] Existing ambiguous legacy sources are reported for explicit classification or removal and are not silently converted into durable user memory.
- [ ] Static retrieval uses scenario, type, ready/current corpus state, Avatar visibility, and explicit GM bypass only.
- [ ] Short-term exchanges, conversation working memory, episodic memories, and long-term user facts retain their existing ownership, compaction, hydration, selection, and bounded injection lifecycle.
- [ ] Conversational memory is neither queried through RAG nor serialized/vectorized as knowledge chunks.
- [ ] Avatar and GM inputs expose separate `Conversation State` and `Retrieved Context` fields with separate provenance; GM unrestricted visibility remains explicit.
- [ ] Retrieved documents cannot become facts or working memory merely because they appeared in a prompt.
- [ ] Conversation-memory clear/reset and user deletion cannot delete scenario knowledge; scenario deletion removes its static sources/chunks; reindex and memory maintenance cannot mutate the other subsystem.
- [ ] Admin/API DTOs, labels, traces, and UI distinguish static shared knowledge, working memory, episodic memory, and long-term user facts.
- [ ] Tests prove conversational-memory cross-user isolation and static-knowledge cross-user consistency, including Avatar visibility and GM bypass.
- [ ] No new HTTP endpoint is required by this pack. If implementation introduces one, it includes route tests and a colocated `*.stack-e2e.test.ts` covering auth, validation, not-found where applicable, and success behavior.
- [ ] `docs/PROJECT_STATUS.md`, `docs/EPICS.md`, `docs/MEMORY_SYSTEM_SPEC.md`, `docs/RAG_SYSTEM_IMPLEMENTATION.md`, `docs/AVATAR_RAG_SETUP_GUIDE.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACT.md`, `docs/GAME_MASTER_CONTRACT.md`, and impacted testing/architecture docs are accurate.
