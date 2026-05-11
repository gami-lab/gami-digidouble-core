# Title

Console Integration, Hardening, And Full Documentation Sync

# Context

After backend contracts and retrieval behavior are in place, EPIC 5.1 must become operable. This slice integrates the new capabilities into the console/admin workflows, closes testing gaps, and finalizes documentation.

# Scope

Implement now:

- connect console/admin surfaces to knowledge source and ingestion APIs
- expose retrieval inspection in runtime/debug views with bounded, safe payloads
- add regression tests for critical end-to-end operator flows
- harden error handling and observability around ingestion/retrieval paths
- perform complete documentation review and update

Out of scope:

- new product-facing end-user UI
- EPIC 5.2 context engine redesign

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Reuse shared DTOs from `packages/shared` in `apps/console` API clients/components.
- Keep console changes focused on EPIC 5.1 operator outcomes (upload/register, ingest, status, retrieval inspectability).
- Add targeted UI tests or integration tests for console API adapters where existing patterns exist.
- Ensure observability includes request IDs, durations, and ingestion/retrieval status events.
- Validate no sensitive source content is unintentionally exposed in debug payloads.

# Constraints

- No design-system overhaul or unrelated UI refactor.
- Keep admin workflows clear and minimal.
- Preserve existing debug surfaces; extend without duplicating navigation paths.
- KISS and DRY over broad abstractions.

# Deliverables

- console integration for EPIC 5.1 operations
- hardening tests across backend and console touchpoints
- verified observability and error handling
- full documentation sync across impacted docs

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Console/admin can manage and inspect EPIC 5.1 knowledge workflows end-to-end.
- [ ] Retrieval and ingestion failures are diagnosable without DB access.
- [ ] Contract reuse is enforced in console/backend boundaries.
- [ ] Test suite covers critical regression paths introduced by EPIC 5.1.
- [ ] All impacted docs are updated and consistent with shipped behavior.
