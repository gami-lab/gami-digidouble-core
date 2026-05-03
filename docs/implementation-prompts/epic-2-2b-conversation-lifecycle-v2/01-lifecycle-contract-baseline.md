# 01 — Lifecycle Contract Baseline

## Context

EPIC 2.2b extends existing conversation/session lifecycle behavior. This introduces high risk of contract drift because lifecycle fields already exist across API contracts, domain models, repositories, and console DTOs.

This prompt establishes a canonical contract baseline first so feature work does not multiply duplicate shapes.

## Scope

In scope:

- Identify touched entities and DTOs: `Session`, `Conversation`, conversation end reason, memory summary outputs, lifecycle response envelopes.
- Verify canonical owners for each shape across `apps/core`, `packages/shared`, and `apps/console`.
- Remove or consolidate obvious duplicated lifecycle types if adding one field would require editing multiple equivalent shapes.
- Ensure nullability/optionality for lifecycle fields (`endedAt`, `reason`, status) is consistent across layers.

Out of scope:

- Endpoint/business behavior changes.
- Heuristic logic or compaction algorithm implementation.

## Relevant Docs

- `docs/EPICS.md` (EPIC 2.2b section)
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Map lifecycle contract ownership before editing code:
  - Domain lifecycle state in `apps/core/src/domain/conversation/*`
  - API response/request DTOs in `packages/shared` (preferred canonical owner for cross-app types)
  - Console consumption in `apps/console/src/api/*`
- Prefer re-export/import from `@gami/shared` over local type copies.
- If you find repeated inline shapes in routes/use-cases/tests, create one canonical type and migrate references.
- Keep changes minimal: only refactor where duplication is real and lifecycle-related.

## Constraints

- Respect 4-layer architecture (API -> Application -> Domain -> Infrastructure).
- No behavior changes in this prompt unless required to preserve compatibility after type consolidation.
- KISS, YAGNI, DRY.
- Backward compatibility for existing stable endpoints.

## Deliverables

- Consolidated lifecycle contracts with clear canonical owners.
- Any small refactor commits necessary to prevent drift before feature work.
- Updated type imports in core/console/tests where needed.

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
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

## Acceptance Criteria

- [ ] Lifecycle DTO ownership is explicit and centralized.
- [ ] No obvious duplicated lifecycle shapes remain in touched areas.
- [ ] Optional/null fields are consistent across layers.
- [ ] Existing tests still pass after refactor-only changes.
- [ ] Documentation accuracy has been verified/updated.
