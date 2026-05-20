# EPIC 5.1b - Avatar-Scoped Knowledge Visibility

## Objective

Implement deterministic avatar-scoped knowledge visibility so Avatar retrieval is filtered by active avatar, while Game Master retrieval remains unrestricted.

## Generated

2026-05-20

## Dependencies Between Prompts

- `00-contract-cleanup.md` is mandatory before feature work.
- `01-visibility-data-model-and-contracts.md` establishes the canonical schema and contract ownership used by all later prompts.
- `02-retrieval-filtering-and-context-engine-integration.md` depends on `01`.
- `03-gm-omniscience-admin-inspector-observability.md` depends on `01` and `02`.
- `04-console-visibility-editing.md` depends on `01` and `03`.
- `05-tests-hardening-doc-sync.md` runs last and closes the EPIC.

## Ordered Execution List

| #   | File                                                       | Purpose                                                                                     |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 0   | `00-contract-cleanup.md`                                   | Remove contract duplication and establish canonical owners before adding visibility fields  |
| 1   | `01-visibility-data-model-and-contracts.md`                | Add avatar visibility metadata in domain/schema/contracts with backward-compatible defaults |
| 2   | `02-retrieval-filtering-and-context-engine-integration.md` | Enforce deterministic avatar-scoped retrieval in Context Engine and retrieval services      |
| 3   | `03-gm-omniscience-admin-inspector-observability.md`       | Preserve unrestricted GM retrieval and expose explainable visibility diagnostics            |
| 4   | `04-console-visibility-editing.md`                         | Add admin console surfaces to inspect and edit visibility metadata safely                   |
| 5   | `05-tests-hardening-doc-sync.md`                           | Final hardening, full coverage, and required documentation synchronization                  |

## Suggested Execution Order

`00 -> 01 -> 02 -> 03 -> 04 -> 05`

## Definition Of Done (Full EPIC)

- [ ] Avatar retrieval includes only knowledge visible to the active avatar.
- [ ] Shared world knowledge remains accessible where visibility allows shared/public scope.
- [ ] Game Master retrieval remains unrestricted across `memory`, `world`, and `media`.
- [ ] Visibility filtering is deterministic, traceable, and surfaced in runtime inspection metadata.
- [ ] Existing knowledge sources/chunks remain backward compatible via explicit default visibility behavior.
- [ ] Contract ownership is canonical with no duplicated API-facing shapes across core, shared, and console.
- [ ] If new endpoints are introduced, each has a `*.stack-e2e.test.ts` file with auth/validation/not-found coverage.
- [ ] Console admin supports visibility editing without violating API/domain boundaries.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and required integration/stack-e2e suites pass.
- [ ] `docs/PROJECT_STATUS.md` and all impacted docs are updated and accurate.
