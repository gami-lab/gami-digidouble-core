# Runtime Model Selection for Avatar, GM, and Scenario Defaults

## Context

Operators need controlled runtime model selection to manage quality, latency, and cost per scenario. EPIC 6.1 requires model assignment at avatar level, GM level, and scenario default level.

## Scope

In scope:

- admin UI and backend support for model selection settings:
  - scenario default model profile
  - per-avatar override
  - GM override
- explicit precedence rules (override hierarchy)
- validation against allowed provider/model catalog
- persistence and runtime-read compatibility

Out of scope:

- provider SDK changes
- dynamic model auto-tuning policies

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Keep all model/provider access behind existing internal LLM abstraction.
- Add/update contracts for model assignment without hard-coding provider details in business logic.
- Define and document precedence clearly (avatar override > scenario default for avatar runtime, GM override for GM runtime, etc.).
- Ensure old scenarios without model settings continue to work via sensible defaults.
- Ensure admin app reads and writes these settings through canonical contracts only.

For each new endpoint introduced, add:

- stack-e2e file: `apps/core/src/api/routes/<route-name>.stack-e2e.test.ts`
- auth/validation/not-found minimum assertions (`401`, `400`, `404` + envelope code)

## Constraints

Respect:

- architecture boundaries and provider abstraction rules
- KISS, YAGNI, DRY
- strict typing and explicit contracts
- backward compatibility for existing scenarios

## Deliverables

- admin model-selection UI flows for scenario/avatar/GM
- backend contracts/use cases/repositories for persisted model assignment
- precedence-rule tests for runtime resolution behavior
- required stack-e2e coverage for newly introduced routes

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
- `docs/ARCHITECTURE.md` (if runtime wiring changes)
- `docs/TECH_STACK.md` (if model-catalog assumptions/tooling changed)
- `docs/GAME_MASTER_CONTRACT.md` (if GM runtime model semantics changed)

If no doc changes are needed, explicitly confirm docs remain accurate.

## Acceptance Criteria

- [ ] admin can configure scenario default, avatar override, and GM override models
- [ ] precedence rules are deterministic and tested
- [ ] runtime continues to work for legacy scenarios without explicit model config
- [ ] every new endpoint includes required stack-e2e coverage
- [ ] required documentation review/update completed
