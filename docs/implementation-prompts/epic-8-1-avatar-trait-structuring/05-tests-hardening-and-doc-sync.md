# Title

Close Test Gaps, Recompute Hardening, And Documentation Sync

# Context

By this point the feature should exist end-to-end. The final slice is to harden the implementation, close gaps around recomputation and contract stability, and update the source-of-truth docs.

This slice should not introduce new product scope. It should only finish the EPIC responsibly.

# Scope

Implement now:

- close remaining deterministic test gaps
- verify recomputation and source-preservation behavior
- validate persistence round-trips and route contracts
- complete final documentation updates for the EPIC

Out of scope:

- new product features
- prompt-assembly changes from EPIC 8.2
- speculative scoring or evaluation systems

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Focus tests on the actual risk:
  - fixed schema stability
  - grounded generation constraints
  - recomputation after source changes
  - source preservation
  - API read consistency
- Add or complete tests across the right tiers:
  - unit: parser/normalizer, source filtering, dedupe/trim rules, no-world-dump behavior
  - integration: Postgres avatar computed-trait round-trip, schema alignment, repository write path
  - e2e: explicit preparation endpoint with deterministic fake LLM wiring
  - stack-e2e: auth/validation/not-found already owned by the endpoint slice; extend happy-path coverage if the environment supports it
  - admin tests: confirm trigger plus read-only inspection flow
- Verify recomputation specifically:
  - modify avatar author text
  - rerun preparation
  - confirm derived traits update
  - confirm original inputs remain intact
- Verify the fixed schema specifically:
  - all avatars return the same field set
  - absent preparation returns `computedTraits: null`
  - prepared avatars never drift to ad-hoc field names
- Update docs as part of the completion, not as a separate afterthought.
- At minimum review and update:
  - `docs/PROJECT_STATUS.md`
  - `docs/API_CONTRACT.md`
  - `docs/DATA_MODEL.md`
  - `docs/EPICS.md`
- Update `docs/ARCHITECTURE.md` or `docs/TEST_STRATEGY.md` only if the implemented design/test ownership changed materially.

# Constraints

Respect:

- current architecture
- KISS
- YAGNI
- DRY
- no scope creep in the hardening slice
- docs remain source of truth

# Deliverables

- completed remaining tests for EPIC 8.1
- verified recomputation and source-preservation behavior
- final documentation sync
- clean validation pass across the relevant repo commands

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
- `docs/EPICS.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Remaining deterministic, integration, e2e, and admin test gaps for EPIC 8.1 are closed.
- [ ] Re-triggering preparation after source changes updates derived traits.
- [ ] Original avatar inputs and supporting documents remain preserved after preparation.
- [ ] The fixed trait schema remains stable across all avatar responses.
- [ ] Final docs are updated and aligned with the implemented behavior.
- [ ] `pnpm lint`, `pnpm typecheck`, and the relevant test suites pass before the EPIC is closed.
