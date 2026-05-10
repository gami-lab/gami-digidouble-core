# Unify the console session-inspector flow

## Context

The console already has multiple inspector-related surfaces:

- `apps/console/src/components/RuntimeInspector.tsx`
- `apps/console/src/api/runtime-inspector.ts`
- `apps/console/src/api/sessions.ts`
- `apps/console/src/pages/SessionAdminPage.tsx`
- `apps/console/src/pages/DebugShellPage.tsx`
- `apps/console/src/components/runtime-inspector-tab-content.tsx`

EPIC 3.2 should turn those into one coherent operator flow, not another parallel read path. The console should consume the canonical backend surfaces discovered in the previous prompts and should remove stale fallbacks or duplicate query wrappers.

## Scope

**In scope:**

- consolidate console data loading into one inspector composition layer
- remove duplicated query wrappers and local view-model copies
- simplify the session list/detail flow so the operator does not have to choose between overlapping debug entry points
- keep the UI focused on session list, detail, messages, memory, events, metrics, and context
- remove console compatibility branches that only exist because the old inspector split used to exist

**Out of scope:**

- adding a new backend endpoint
- large visual redesign
- feature work outside the inspection workflow

## Relevant Docs

- `docs/EPICS.md` - EPIC 3.2 intent
- `docs/API_CONTRACT.md` - final session-inspector contract shape
- `docs/ARCHITECTURE.md` - console as a consumer of Core APIs
- `docs/TEST_STRATEGY.md` - console contract and stack-E2E expectations
- `docs/PROJECT_STATUS.md` - current console inspection state

## Implementation Guidance

1. Start by mapping the current console inspector flow:
   - identify which component owns list navigation
   - identify which component owns detailed inspection
   - identify which API module is the canonical query layer
   - remove duplicated local view models and helper aliases

2. Prefer one console-side composition entrypoint for inspector data. If `RuntimeInspector` and `SessionAdminPage` overlap, keep the cleaner canonical path and delete the redundant one rather than keeping both around with slightly different semantics.

3. Replace multiple thin API wrappers with one query module where possible. The console should not carry separate compatibility helpers for data that already has one canonical source.

4. Keep the inspector output bounded and consumer-friendly. The operator needs a clean session story, not every internal detail the backend can expose.

5. If a backend route was removed in the previous prompt, update the console to stop calling it rather than reintroducing it through a compatibility wrapper.

6. Make the console state flow explicit:
   - selected session
   - loaded inspector snapshot
   - live events if relevant
   - error state and reload behavior

## Constraints

- no backward compatibility code in the console for the removed inspector split
- KISS: one flow, one query layer, one rendering path where possible
- do not duplicate API DTOs locally if `@gami/shared` already owns the shape
- no hidden fallback to old inspector routes

## Deliverables

- a single clear console inspector flow
- redundant console query wrappers or local DTO copies removed
- session detail rendering tied to the canonical backend surfaces
- no parallel legacy inspector path left behind

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step - Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` if the console-facing contract or inspector flow changed
- `docs/ARCHITECTURE.md` if console ownership or boundaries changed
- `docs/TEST_STRATEGY.md` if the test shape changed

If no doc changes are needed, explicitly verify that the docs are still accurate.

## Acceptance Criteria

- [ ] the console uses one inspector composition flow instead of multiple overlapping paths
- [ ] duplicated local query wrappers or view models are removed
- [ ] the operator can inspect a session without switching between redundant console surfaces
- [ ] no removed backend route is reintroduced through a compatibility branch
- [ ] console tests pass
