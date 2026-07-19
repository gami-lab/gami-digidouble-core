# Harden Runtime Context Refactoring And Synchronize Documentation

# Context

The final slice verifies the user-visible contract of EPIC 8.2 rather than only asserting that helper functions execute. The highest risks are silent section-order regressions, prepared traits being ignored, legacy avatars breaking, low-priority context displacing operational instructions, and observability exposing sensitive prompt material.

# Scope

Implement now:

- complete focused unit, integration, and in-process E2E coverage appropriate to the changed modules;
- verify deterministic ordering, trait preference, fallback, token budgets, and context separation;
- verify the normal send-message contract and runtime inspection safety;
- run relevant repository quality gates;
- update all impacted source-of-truth documentation and mark EPIC 8.2 progress accurately.

Out of scope:

- new product behavior not defined by EPIC 8.2;
- real-provider quality scoring or prose evaluation;
- trait regeneration tests owned by EPIC 8.1;
- RAG ranking/ingestion changes;
- a new endpoint or a new UI surface.

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Add deterministic persona-prompt tests for:
  - exact target section order;
  - Director Notes and Response Rules before static identity;
  - Conversation State separation;
  - world versus retrieved context separation;
  - all seven trait fields in fixed order;
  - computed-trait preference over raw `personaPrompt`;
  - null/missing-trait fallback;
  - empty optional sections;
  - deterministic output for identical input.
- Add or update Context Engine tests for:
  - precedence metadata;
  - protected high-priority segments;
  - deterministic budget trimming;
  - preservation of typed retrieval and GM projection rules;
  - trait presence/selection metadata if that contract was added.
- Add or update send-message tests from the consumer boundary. Assert the actual LLM request system prompt contains the required sections and trait values, not only that an internal helper received an object.
- Add runtime inspector/event tests that assert bounded metadata and explicitly assert that raw prompt content, raw trait text, hidden retrieval text, and credentials are absent.
- Use unit tests with deterministic fixtures and fake/null LLM adapters. Do not test writing quality or exact provider prose.
- Run the narrowest relevant checks first, then the repository gates described in `docs/TEST_STRATEGY.md` (`pnpm lint`, `pnpm typecheck`, `pnpm test`, and relevant integration/E2E suites when their environment is available).
- Do not add a stack-e2e file for this EPIC because no HTTP endpoint is introduced. If implementation scope changes and a new endpoint is added, stop and apply the repository's stack-e2e ownership rule in the same EPIC.
- Update documentation as part of the implementation:
  - `docs/PROJECT_STATUS.md` with the completed runtime context behavior and verification status;
  - `docs/ARCHITECTURE.md` with the context/prompt assembly responsibility and ordering if stale;
  - `docs/API_CONTRACT.md` or shared runtime-inspector contract docs if wire shapes changed;
  - `docs/DATA_MODEL.md` only if the implemented runtime contract changes persisted model semantics;
  - `docs/TEST_STRATEGY.md` or `docs/TEST_COVERAGE_PLAN.md` if new coverage ownership or observability rules were introduced;
  - `docs/EPICS.md` to reflect EPIC 8.2 completion only when all acceptance criteria are actually met.

# Constraints

Respect:

- deterministic, consumer-oriented testing;
- existing test-tier suffix rules;
- no real provider dependency in blocking unit tests;
- no snapshots that merely mirror implementation details;
- no contract drift;
- no documentation claim that exceeds verified implementation.

# Deliverables

- complete regression coverage for EPIC 8.2;
- validated compatibility behavior for prepared and unprepared avatars;
- validated bounded and content-safe runtime diagnostics;
- successful relevant quality gates, with environment-gated suites reported accurately;
- final documentation synchronization.

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] Tests prove the exact runtime section order and semantic separation.
- [ ] Tests prove prepared avatars use `computedTraits` and legacy avatars use the compatibility fallback.
- [ ] Tests prove high-priority instructions are not displaced by low-priority context under budget pressure.
- [ ] Tests prove retrieval visibility and GM projection behavior remain intact.
- [ ] Tests prove runtime diagnostics do not leak raw prompt or sensitive content.
- [ ] Relevant lint, typecheck, and test commands pass, with unavailable environment-gated suites clearly reported.
- [ ] `docs/PROJECT_STATUS.md` is updated and all impacted docs are accurate.
- [ ] EPIC 8.2 is marked complete only if every definition-of-done item is verified.
