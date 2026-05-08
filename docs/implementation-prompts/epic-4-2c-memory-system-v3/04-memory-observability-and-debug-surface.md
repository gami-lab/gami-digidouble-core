# 04 — Memory Observability And Debug Surface

## Context

`MEMORY_SYSTEM_SPEC.md` requires inspectable memory and hydration decisions. Operators need a clear runtime view of what memory was selected, why it was selected, and when hydration occurred.

## Scope

Implement now:

- memory selection observability payloads (structured metadata, not prose-only logs)
- hydration observability signals/events
- admin/debug API surface updates for memory decision inspection
- console/runtime inspector integration for new observability fields if contracts changed

Out of scope:

- broad console redesign beyond memory debug additions
- unrelated admin endpoint redesign

## Relevant Docs

- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Prefer extending existing admin memory inspect routes when practical to reduce API sprawl.
- If introducing a new endpoint, include full route validation and stack-e2e coverage in the same EPIC slice.
- Observability output should include:
  - memory source identifiers
  - selected vs rejected counts
  - top selection reasons
  - hydration run timestamp and conversation linkage
- Keep sensitive prompt/provider data out of debug payloads.

## Constraints

- No undocumented contract changes.
- No leakage of credentials or raw hidden prompts.
- Maintain `ApiResponse<T>` envelope shape.
- Keep additions additive where possible for backward compatibility.

## Deliverables

- updated admin debug contract(s)
- route/use-case implementation for memory observability
- tests for auth, validation, not-found, and success-path behavior
- console binding updates if API shape changes

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
- `docs/TEST_STRATEGY.md` (if test tier responsibilities change)
- any console debug docs impacted

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- [ ] Memory selection decisions are observable via admin/debug surface.
- [ ] Hydration events/signals are inspectable.
- [ ] Any new endpoint includes `*.stack-e2e.test.ts` coverage for auth/validation/not-found.
- [ ] Console/admin consumer contracts stay drift-free.
- [ ] Build gates pass and docs are synced.
