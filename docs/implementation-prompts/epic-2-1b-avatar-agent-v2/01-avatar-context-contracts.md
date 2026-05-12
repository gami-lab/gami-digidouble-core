# Title

Define Avatar v2 Context Contracts

# Context

Avatar v2 requires explicit contracts for persona, memory layers, and typed retrieval inputs used by prompt assembly. Without clear contracts, feature slices will reintroduce drift between domain logic, API DTOs, and console surfaces.

# Scope

In scope:

- define/refine Avatar v2 context input contracts in canonical locations
- separate internal context contracts from shared HTTP DTO contracts
- define deterministic context trace shape needed for inspection

Out of scope:

- full prompt implementation
- retrieval scoring policy changes
- GM behavior changes beyond contract compatibility

# Relevant Docs

- `docs/EPICS.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`

# Implementation Guidance

- Extend canonical domain context types to express Avatar v2 inputs:
  - user persona payload
  - bounded short-term exchange window
  - conversation working summary hooks
  - long-term/episodic memory excerpts
  - typed retrieval sections (`memory`, `world`, `media`)
- Ensure contracts remain compatible with Context Engine ownership and existing GM input contracts.
- If admin/shared DTOs require exposure, map from domain contracts instead of duplicating shapes.
- Add strict type-level tests or compile-time assertions where helpful.

# Constraints

- Keep contracts additive and backward-compatible.
- Preserve strict TypeScript typing (`no any`).
- Avoid exposing sensitive prompt text/credentials in shared DTOs.
- No API endpoint additions in this slice unless required.

# Deliverables

- Canonical Avatar v2 context contract set.
- Updated mapper boundaries (domain -> shared DTO where needed).
- Contract-level tests or assertions.

# Mandatory Stack E2E Rule

If this slice adds any new HTTP endpoint, add at least one corresponding `*.stack-e2e.test.ts` file that validates:

- auth behavior
- request validation behavior
- not-found or invalid-id behavior
- happy-path response envelope and shape

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step - Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Avatar v2 context contracts are explicit and canonical.
- [ ] Internal and shared contract ownership boundaries are clear.
- [ ] No duplicate context shapes remain in touched areas.
- [ ] Contract changes compile and tests remain green.
- [ ] Any new endpoint has matching `*.stack-e2e.test.ts` coverage.
