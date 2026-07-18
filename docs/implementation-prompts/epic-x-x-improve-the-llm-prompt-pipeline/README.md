# EPIC X.X - Improve the LLM Prompt Pipeline

## Objective

Improve the quality, consistency, and maintainability of the full LLM prompt pipeline across Avatar response generation, Game Master orchestration, and working-memory compaction without introducing new product capabilities.

The implementation should reduce prompt entropy, clarify contract ownership, separate static reference content from runtime state, and keep the system easier to inspect and evolve.

## Generated

2026-07-18

## Dependencies Between Prompts

- `00-prompt-pipeline-contract-baseline.md` is mandatory before feature work because this EPIC touches Avatar, GM, memory, and admin-facing contracts that already exist in multiple layers.
- `01-persona-representation-and-runtime-shaping.md` depends on `00` because persona contract ownership must be clear before storage or runtime shaping changes.
- `02-avatar-context-priority-and-prompt-assembly.md` depends on `00` and should follow `01` so Avatar prompt assembly consumes the refined persona representation.
- `03-game-master-prompt-separation-and-decision-clarity.md` depends on `00` and should follow `02` if shared context ordering or contract names changed.
- `04-working-memory-structure-and-compaction-prompt.md` depends on `00` and should follow `03` when GM-consumed memory structure is refined in parallel.
- `05-regression-hardening-and-doc-sync.md` must run last.

## Ordered Execution List

| #   | File                                                       | Purpose                                                                                                  |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 0   | `00-prompt-pipeline-contract-baseline.md`                  | Audit duplicated prompt-pipeline contracts and define canonical ownership before changing behavior       |
| 1   | `01-persona-representation-and-runtime-shaping.md`         | Refine how avatar persona data is authored, stored, transformed, and consumed at runtime                 |
| 2   | `02-avatar-context-priority-and-prompt-assembly.md`        | Reorganize Avatar runtime context and prompt assembly around operational priority                        |
| 3   | `03-game-master-prompt-separation-and-decision-clarity.md` | Refactor the GM prompt so role, policy, runtime context, and output rules are clearly separated          |
| 4   | `04-working-memory-structure-and-compaction-prompt.md`     | Improve working-memory structure and the compaction prompt for better continuity and progression signals |
| 5   | `05-regression-hardening-and-doc-sync.md`                  | Close with regression coverage, contract verification, and full documentation sync                       |

## Suggested Execution Order

`00 -> 01 -> 02 -> 03 -> 04 -> 05`

## Definition of Done (Full EPIC)

- [ ] Contract ownership is explicit for all touched prompt-pipeline shapes across `apps/core`, `apps/console`, and `packages/shared`.
- [ ] Persona information reaches runtime in a clearer structure without silently discarding administrator-authored intent.
- [ ] Avatar prompt assembly distinguishes runtime instructions, current state, user info, retrieved knowledge, and permanent avatar information by priority.
- [ ] Game Master prompt instructions are shorter, clearer, and separated by responsibility without changing the GM's product role.
- [ ] Working-memory compaction output better distinguishes discussed topics, unresolved threads, and durable facts.
- [ ] Prompt-pipeline behavior is protected by deterministic unit tests and any required contract/API tests.
- [ ] If any new HTTP endpoint is added, a matching `*.stack-e2e.test.ts` file exists with auth, validation, and not-found coverage.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` pass.
- [ ] `docs/PROJECT_STATUS.md` and all impacted docs are updated and consistent with the implementation.
