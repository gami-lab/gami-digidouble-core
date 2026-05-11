# EPIC 5.2 — Context Engine v2 (Core Orchestrator)

## Objective

Implement a deterministic Context Engine that assembles bounded, explainable runtime context for Avatar and Game Master from memory, typed retrieval, scenario state, GM guidance, and user persona.

The implementation must keep context selection deterministic, token-budget aware, and contract-safe across API, Application, Domain, and Console layers.

## Generated

2026-05-11

## Dependencies Between Prompts

- `00-contract-cleanup.md` is mandatory before feature work.
- `01-context-engine-domain-contracts.md` defines canonical contracts and ownership required by all later slices.
- `02-context-selection-priority-and-token-budget.md` depends on `01`.
- `03-context-assembler-integration-avatar-gm.md` depends on `01` and `02`.
- `04-context-observability-and-admin-contracts.md` depends on `03`.
- `05-hardening-tests-and-doc-sync.md` must run last.

## Ordered Execution List

| #   | File                                                | Purpose                                                                                   |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 0   | `00-contract-cleanup.md`                            | Remove duplicated context contracts and define canonical ownership before adding behavior |
| 1   | `01-context-engine-domain-contracts.md`             | Define Context Engine inputs/outputs and module boundaries                                |
| 2   | `02-context-selection-priority-and-token-budget.md` | Implement deterministic precedence, trimming, and token budgeting                         |
| 3   | `03-context-assembler-integration-avatar-gm.md`     | Integrate engine into Avatar/GM context assembly flows                                    |
| 4   | `04-context-observability-and-admin-contracts.md`   | Expose explainable assembled context through stable admin/shared contracts                |
| 5   | `05-hardening-tests-and-doc-sync.md`                | Close with regression hardening, contract checks, and full documentation sync             |

## Suggested Execution Order

`00 -> 01 -> 02 -> 03 -> 04 -> 05`

## Definition of Done (Full EPIC)

- [ ] Canonical ownership exists for all Context Engine contracts with no duplicated API-facing shapes.
- [ ] Context assembly is deterministic and explains precedence across memory, RAG, scenario, GM directives, and persona.
- [ ] Token budget rules are explicit, testable, and applied consistently as selection telemetry (no hard trimming).
- [ ] Avatar and GM context assembly consume one shared Context Engine pipeline instead of parallel ad-hoc composition.
- [ ] Context observability/admin surfaces expose assembled context without leaking sensitive prompt or credential data.
- [ ] If any new HTTP endpoint is added, a matching `*.stack-e2e.test.ts` file exists with auth/validation/not-found coverage.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` pass.
- [ ] `docs/PROJECT_STATUS.md` and all impacted docs are updated and consistent.
