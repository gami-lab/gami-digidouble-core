# Admin Runtime Actions + Audit Trail

## Context

EPIC 2.7 requires operational debug actions from the console:

- reset session
- replay GM
- clear memory
- trigger memory refresh

Reset already exists, but EPIC 2.7 should decide whether the clean admin action surface should keep
that route as-is or fold it into a more coherent admin action plane. The system also needs safe
semantics: operators must be able to debug a session without accidentally deleting cross-session
user data.

## Scope

**In scope:**

- design one clean admin action surface for runtime operations
- reuse the existing reset behavior rather than reimplementing it, but feel free to move or rename
  the admin route if that produces a cleaner final surface
- add the missing admin action endpoints, for example:
  - `POST /v1/admin/sessions/{sessionId}/gm/replay`
  - `POST /v1/admin/sessions/{sessionId}/memory/refresh`
  - `POST /v1/admin/sessions/{sessionId}/memory/clear`
- make admin actions auditable
- emit safe operator-facing events/logs for those actions
- add route tests and stack-e2e files for every new endpoint

**Out of scope:**

- deleting long-term `user_memory_facts` across the whole user account
- generic job queue infrastructure redesign
- broad RBAC/permission system work beyond current API-key admin guardrails

## Relevant Docs

- `docs/EPICS.md` — EPIC 2.7 required operational actions
- `docs/ARCHITECTURE.md` — admin actions belong in the admin plane
- `docs/TECH_STACK.md` — admin inspection API + audit log direction
- `docs/DATA_MODEL.md` — session memory vs user memory separation
- `docs/API_CONTRACT.md` — existing reset route behavior and error envelopes
- `docs/TEST_STRATEGY.md` — contract tests for admin APIs
- `docs/TEST_COVERAGE_PLAN.md` — reset/replay/admin-action-log expectations already documented

## Implementation Guidance

1. Read the current reset-session implementation and any existing audit-log infrastructure before
   adding anything new.

2. Decide the final admin action shape first:
   - if the current reset route already fits the clean admin plane, keep it and do not duplicate it
   - if the current route is only a legacy convenience path, move to a coherent admin action shape
     and remove the superseded route instead of keeping aliases

3. Safe semantics matter more than feature count. For MVP, “clear memory” should mean
   **session-scoped memory clear**, not cross-session fact erasure. A practical safe default is:
   - clear session working memory
   - clear avatar working memory rows for the session
   - clear mirrored `sessions.memory_summary` fallback if still present
   - clear `sessions.gm_notes` if it is part of ongoing guidance state
   - do **not** delete `user_memory_facts`
   - do **not** delete the conversation transcript unless the action is explicitly reset

4. “Trigger memory refresh” should reuse the existing async memory-maintenance boundary. It should
   target the latest relevant conversation and avatar for the session and remain non-blocking where
   practical.

5. “Replay GM” should reuse the existing GM orchestration use case in a safe way. Prefer a thin
   application service that validates the session/runtime preconditions before invoking the existing
   GM use case.

6. Auditability:
   - if `AdminActionLog` infrastructure already exists, extend it
   - if it does not, add the smallest coherent implementation aligned with `docs/TECH_STACK.md`
   - record action type, target session, actor/source if available, and timestamp

7. Every new endpoint must have:
   - route tests
   - one matching `*.stack-e2e.test.ts` file
   - auth, validation, and not-found coverage
   - happy path if seedable now, otherwise a clearly marked deferred TODO for the success path

8. The console should be able to poll/reload or observe emitted runtime/admin events after an
   action completes. Make the action responses explicit enough for that UI flow.

## Constraints

- do not duplicate reset behavior under two different admin routes unless there is a strong local
  reason
- do not silently delete long-term user memory under a session-scoped action
- do not block the Avatar response path with synchronous admin maintenance work
- keep admin actions explicit, auditable, and bounded
- use existing use cases/services where possible instead of cloning orchestration logic

## Deliverables

- one clean admin runtime-action surface
- application-layer orchestration for replay GM and memory actions
- audit-log coverage for new admin actions
- route tests and stack-e2e files for each new endpoint in the final action surface

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md` if audit-log or memory-clear semantics require documentation
- `docs/ARCHITECTURE.md` if the admin action plane description changed

If no doc changes are needed, explicitly verify that the docs are still accurate.

## Acceptance Criteria

- [ ] reset behavior is reused, not duplicated, and the final admin action surface is cleaner than
      the current state
- [ ] operators can replay GM, trigger memory refresh, and clear session-scoped memory via admin
      APIs
- [ ] new actions are auditable
- [ ] clear-memory semantics do not delete cross-session `user_memory_facts`
- [ ] every new endpoint has route tests and a matching `*.stack-e2e.test.ts` file
- [ ] `pnpm test` passes for the touched slice
