# Sync docs after inspector cleanup

## Context

This EPIC is only complete when the repository documentation reflects the final, simplified inspector surface. Because the work is explicitly cleanup-first and removes compatibility code, the docs must describe the one canonical path that remains.

## Scope

**In scope:**

- update `docs/PROJECT_STATUS.md` with the final EPIC 3.2 status and implementation notes
- update `docs/API_CONTRACT.md` for the final inspector/admin route shapes and canonical DTO ownership
- update `docs/ARCHITECTURE.md` if the admin/console boundary or inspector flow changed
- update `docs/TEST_STRATEGY.md` if test-tier assumptions or stack-E2E expectations changed
- update `docs/EPICS.md` only if the EPIC wording needs a clarification after the implementation lands

**Out of scope:**

- new implementation work
- changing code just to match stale docs
- preserving obsolete compatibility language in the docs

## Relevant Docs

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/VISION.md`
- `docs/PRINCIPLES.md`

## Implementation Guidance

1. Start from the actual final code and route surface, not from the original EPIC draft.
2. Describe the surviving inspector flow precisely and remove any wording that implies the old split or compatibility paths still exist.
3. Keep the docs terse. The goal is accurate source-of-truth coverage, not narrative expansion.
4. If a route, DTO, or helper was deleted, make sure the docs do not continue to mention it as if it were still supported.
5. If the final implementation ended up with fewer surfaces than the draft, say so plainly.

## Constraints

- docs must follow code, not the other way around
- no compatibility wording for dead routes or dead DTOs
- no speculative future inspector roadmap in this EPIC write-up
- prefer exact route names and exact DTO owners over generic prose

## Deliverables

- refreshed `PROJECT_STATUS.md`
- any required API, architecture, EPIC, or test-strategy updates
- no stale references to removed compatibility paths

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
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md` if wording drifted during implementation

If no doc changes are needed, explicitly verify that the docs are still accurate.

## Acceptance Criteria

- [ ] documentation matches the final inspector surface exactly
- [ ] removed routes, aliases, and compatibility branches are not described as active behavior
- [ ] `docs/PROJECT_STATUS.md` records the EPIC as complete only if the code is actually complete
- [ ] docs remain consistent with the codebase and tests
