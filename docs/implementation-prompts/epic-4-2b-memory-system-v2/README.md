# EPIC 4.2b — Memory System v2: Implementation Prompt Pack

**Generated:** May 6, 2026  
**Epic scope:** pyramidal memory with explicit short-term, working, and long-term layers

---

## Objective

Upgrade the current flat v1 memory model into a bounded pyramidal system that is easier to
reason about, easier to test, and safer to evolve.

This EPIC should deliver:

- explicit short-term memory (`last 2 exchanges`)
- canonical working-memory storage for the session and current avatar
- long-term memory reuse through the existing `user_memory_facts` layer
- background memory maintenance aligned with the async architecture
- deterministic memory retrieval for Avatar and Game Master inputs

This EPIC does **not** build the full Context Engine v2 from EPIC 5.2 and does **not** add RAG.

---

## Why This Needs A Cleanup Slice First

The current codebase has a real memory-contract drift:

- `docs/GAME_MASTER_CONTRACT.md` already describes `context.memory`
- `apps/core/src/domain/game-master/game-master.types.ts` does **not** yet expose that memory
  structure
- `RuntimeContext` still models memory as flat `memorySummary` + `userFacts`
- the current admin memory surface only exposes `SessionMemorySummary`
- `SendMessageUseCase` and `RunGameMasterUseCase` each assemble partial memory inputs separately

Because EPIC 4.2b touches existing Session, RuntimeContext, GM input, and admin DTO contracts,
the pack starts with `00-contract-cleanup.md`.

---

## What Already Exists (Do Not Re-implement)

| Item                                                | Location                                                               | Status |
| --------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| `sessions.memory_summary` string cache              | `infra/postgres/init.sql`, session repositories                        | Live   |
| `user_memory_facts` table + repositories            | `application/ports/IUserMemoryFactRepository.ts`, `infrastructure/db/` | Live   |
| async fact extraction on conversation close         | `end-conversation.use-case.ts`                                         | Live   |
| bounded user-fact injection into avatar prompt      | `send-message.use-case.ts`, `persona-prompt.service.ts`                | Live   |
| `SessionMemorySummary` shared API type              | `packages/shared/src/lifecycle-types.ts`                               | Live   |
| compaction trigger pattern (`void` fire-and-forget) | `end-conversation.use-case.ts`, `run-game-master.use-case.ts`          | Live   |

---

## What This EPIC Builds

| Deliverable                   | Description                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Canonical memory contracts    | Shared ownership for memory-layer shapes across domain, GM input, and admin DTOs |
| Working-memory persistence    | Session-level and avatar-level compact memory stores                             |
| Memory maintenance flow       | Async compaction / refresh after turns and at conversation boundaries            |
| Deterministic memory assembly | Exact short-term window + working memory + long-term facts for Avatar and GM     |
| GM memory awareness           | `GameMasterInput.context.memory` becomes real and bounded                        |
| Admin inspection surface      | Back-office / admin route(s) to inspect layered memory state                     |
| Tests + docs sync             | Unit, integration, route, stack-e2e, and documentation updates                   |

---

## Suggested Execution Order

| #   | File                                           | Delivers                                                                    |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| 0   | `00-contract-cleanup.md`                       | Canonical memory contracts and drift removal before feature work            |
| 1   | `01-working-memory-storage.md`                 | Storage schema, repositories, and backward-compatible persistence ownership |
| 2   | `02-memory-maintenance-pipeline.md`            | Async memory maintenance / compaction orchestration                         |
| 3   | `03-turn-memory-context-assembly.md`           | Avatar turn-time memory retrieval and prompt assembly                       |
| 4   | `04-gm-memory-awareness.md`                    | GM input upgrade to consume the same layered memory model                   |
| 5   | `05-admin-memory-inspection-tests-doc-sync.md` | Admin inspection endpoint(s), stack-e2e, hardening, full doc sync           |

Execute in order. Do not skip the cleanup prompt.

---

## Prompt Dependencies

- `00` is mandatory for every later prompt.
- `01` defines the persistence contracts used by `02`, `03`, `04`, and `05`.
- `02` establishes the background maintenance hook that `05` verifies operationally.
- `03` and `04` should reuse the same canonical memory-assembly logic rather than duplicating
  memory reads.
- `05` is the closure prompt: admin surface, hardening, stack-e2e, and doc sync.

---

## Full Definition Of Done

- memory contracts are canonical and reused across Avatar, GM, admin, and shared DTO surfaces
- short-term memory is deterministic and bounded to the last 2 exchanges only
- working memory is persisted outside raw message replay and can be retrieved independently
- avatar-scoped working memory exists without duplicating full transcripts
- long-term memory continues to reuse `user_memory_facts` rather than inventing a second store
- Avatar and GM both consume layered memory through shared assembly logic
- async memory maintenance never blocks the avatar response path
- session reset clears short-term / working memory but does **not** delete long-term user facts
- any new HTTP endpoint introduced by this EPIC has a `*.stack-e2e.test.ts` file
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` pass
- docs are updated and accurate:
  - `docs/PROJECT_STATUS.md`
  - `docs/DATA_MODEL.md`
  - `docs/API_CONTRACT.md`
  - `docs/GAME_MASTER_CONTRACT.md`
  - `docs/TEST_COVERAGE_PLAN.md`
  - any other impacted docs

---

## Key Constraints

- keep the modular monolith boundaries intact
- no provider SDK leakage into application or domain logic
- no full transcript replay as a memory strategy
- no queue / worker system introduction in Phase A unless already required elsewhere
- no speculative episodic graph memory or embeddings-based memory in this EPIC
- no Context Engine v2 redesign here; only the minimum extraction needed to make layered memory real
