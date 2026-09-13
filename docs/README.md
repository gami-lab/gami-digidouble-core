# Documentation map

`docs/` is the compact design context for future development. Code and shared TypeScript types are
the field-level source of truth; these documents record durable decisions, boundaries, invariants,
and current status.

## Read first

1. [PRINCIPLES.md](PRINCIPLES.md) — decision rules.
2. [ARCHITECTURE.md](ARCHITECTURE.md) — layers, module ownership, and runtime flow.
3. [TECH_STACK.md](TECH_STACK.md) — technology constraints and provider boundaries.
4. [API_CONTRACT.md](API_CONTRACT.md) and [DATA_MODEL.md](DATA_MODEL.md) — public and persisted contracts.
5. The relevant module contract: [GAME_MASTER_CONTRACT.md](GAME_MASTER_CONTRACT.md),
   [MEMORY_SYSTEM_SPEC.md](MEMORY_SYSTEM_SPEC.md), or the RAG/embedding guides. The separate
   [RAG_SYSTEM_AUDIT.md](RAG_SYSTEM_AUDIT.md) is an evaluative review and backlog input, not a
   runtime contract.
6. [TEST_STRATEGY.md](TEST_STRATEGY.md) and [TEST_COVERAGE_PLAN.md](TEST_COVERAGE_PLAN.md) before adding tests.
7. [PROJECT_STATUS.md](PROJECT_STATUS.md) and [EPICS.md](EPICS.md) for current work.

## Maintenance rules

- Keep documents short and present-tense.
- Record why a boundary exists; do not mirror implementation details, file inventories, or test cases.
- Put exact DTO fields, validation schemas, route options, and algorithms in code and link to the owner.
- Keep one source of truth for each decision. Delete or merge duplicate explanations.
- Update `PROJECT_STATUS.md` only for meaningful shipped/open work, not for every commit.
- Treat `implementation-prompts/` and `explorations/` as historical material, not runtime context.
