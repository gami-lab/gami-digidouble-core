# Async Memory Maintenance Pipeline

## Context

EPIC 4.2 delivered one asynchronous memory update path: compaction on conversation close.
EPIC 4.2b requires memory to be updated continuously while preserving the repo’s async-by-default
latency model.

The right design is a lightweight background maintenance flow aligned with the existing
fire-and-forget orchestration pattern used by the Game Master.

## Scope

**In scope:**

- memory maintenance / compaction services for session and avatar working memory
- async orchestration hooks after avatar turns and at conversation boundaries
- event-log observability for memory maintenance lifecycle
- reset / close semantics that keep memory transitions coherent

**Out of scope:**

- prompt rendering for Avatar or GM consumers
- new admin endpoints

## Relevant Docs

- `docs/PRINCIPLES.md` §8 — async by default
- `docs/ARCHITECTURE.md` — async where valuable
- `docs/DATA_MODEL.md` §8–10
- `docs/TEST_COVERAGE_PLAN.md` — memory module expectations
- current references:
  - `apps/core/src/application/services/message-history-compaction.service.ts`
  - `apps/core/src/application/use-cases/end-conversation/end-conversation.use-case.ts`
  - `apps/core/src/application/use-cases/send-message/send-message.use-case.ts`
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`

## Mandatory Pre-Implementation Check

1. Identify touched entities/contracts:
   - session working memory
   - avatar working memory
   - event-log event names / payloads
   - session reset and conversation close flows
2. Search for duplicated async trigger logic.
3. Confirm the canonical owner for maintenance result types and event payloads.
4. Reuse the existing fire-and-forget pattern rather than inventing a second async mechanism.
5. If event payloads are drifting from other operational events, normalize them first.

## Implementation Guidance

1. Introduce a dedicated application boundary for memory maintenance instead of embedding more
   compaction logic directly into `SendMessageUseCase` and `EndConversationUseCase`.

   Keep it small, for example:
   - `IMemoryMaintenancePort` or
   - `RefreshMemoryLayersUseCase`

   The job of this boundary is to:
   - load the recent bounded message window
   - update session working memory
   - update avatar working memory for the current avatar
   - optionally refresh the legacy `sessions.memory_summary` mirror while compatibility remains

2. Reuse deterministic summarization first. Do **not** introduce a new LLM dependency for working
   memory compaction unless the existing deterministic approach clearly cannot satisfy the prompt.
   If an LLM is required for one slice, isolate it behind a port.

3. Trigger maintenance asynchronously:
   - after each completed avatar turn in `SendMessageUseCase`
   - after explicit/implicit conversation close when that boundary is more appropriate

   Keep the call pattern non-blocking:
   - `void this.memoryMaintenance.execute(...)`
   - safe internal error handling
   - event-log diagnostics instead of thrown errors

4. Emit memory-maintenance lifecycle events to `event_log` with a bounded, grep-friendly naming
   family parallel to the existing compaction events. Example direction:
   - `memory_refresh_triggered`
   - `memory_refresh_succeeded`
   - `memory_refresh_failed`

5. Preserve semantics:
   - the Avatar response path must never wait on memory maintenance
   - close/reset flows must still succeed even if maintenance fails
   - long-term fact extraction on close remains distinct from working-memory refresh

6. Add tests that prove behavior, not just method calls:
   - send message returns before maintenance finishes
   - maintenance updates session/ avatar working memory afterward
   - failures log events and do not break the turn / close
   - repeated turns update the same memory row(s) rather than creating duplicates

## Constraints

- async-only: never block the avatar reply on memory maintenance
- no raw transcript duplication in working memory
- no queue / worker / scheduler system in this EPIC
- event names and payloads should stay compact and operationally useful
- keep long-term fact extraction separate from working-memory refresh responsibilities

## Deliverables

- dedicated memory maintenance application boundary
- background wiring from turn flow and/or close flow
- updated event-log diagnostics for memory refresh lifecycle
- tests proving non-blocking behavior and successful persistence updates

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs still match the implemented maintenance
flow.

## Acceptance Criteria

- [ ] working-memory refresh is triggered asynchronously from the turn/close flow
- [ ] failures never block avatar replies or conversation closure
- [ ] session and avatar working memory are refreshed without transcript duplication
- [ ] memory-refresh events are emitted to `event_log`
- [ ] behavior-scoped tests prove non-blocking maintenance semantics
