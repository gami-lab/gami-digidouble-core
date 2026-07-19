# Harden Game Master Prompt Refinement And Synchronize Documentation

# Context

The final EPIC 8.3 slice verifies that prompt refinement improved clarity without destabilizing the Game Master runtime. The main risks are silent contract drift, prompt-structure regressions, overfitting tests to string trivia, and stale documentation that no longer matches the GM architecture.

# Scope

Implement now:

- complete focused unit and in-process integration coverage for the refined GM prompt path;
- verify contract compatibility and event safety;
- run the relevant quality gates;
- update all impacted source-of-truth documentation and mark EPIC 8.3 progress accurately.

Out of scope:

- new Game Master product behavior beyond EPIC 8.3 prompt refinement;
- new HTTP endpoints or UI surfaces;
- real-provider prompt-quality benchmarking as a blocking test;
- memory-generation or retrieval-ranking changes.

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Add or update deterministic tests for:
  - static GM system prompt section order;
  - dynamic GM input rendering section order;
  - omission of empty optional sections;
  - session-start behavior when `userMessage.text` is empty;
  - preservation of validation-critical output instructions;
  - evidence-based guidance language that discourages unnecessary progression and switching.
- Add or update `RunGameMasterUseCase` tests from the consumer boundary:
  - assert the actual `systemPrompt`;
  - assert the actual LLM message content structure;
  - assert that scenario goals, avatar availability, persona, memory, and retrieval context still appear when expected;
  - assert that the runtime still saves notes, state, unlocks, and events as before.
- Keep tests deterministic and structural:
  - do not test prose quality;
  - do not assert the model “made the best decision” through live generation;
  - do not use snapshots that merely mirror full prompt strings without intent.
- Verify safe observability and diagnostics:
  - GM event payloads still do not leak raw prompt content;
  - runtime-inspector or admin tests remain accurate if they depend on GM summaries;
  - no new hidden prompt material or provider metadata is surfaced unintentionally.
- Run the narrowest checks first, then repository gates as available:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - any relevant environment-gated integration suites if available
- Do not add a new stack-e2e file for this EPIC. No HTTP endpoint is introduced. If scope changes and an endpoint appears, stop and add the required stack-e2e ownership in the same EPIC.
- Update documentation as part of the implementation:
  - `docs/PROJECT_STATUS.md` with EPIC 8.3 progress and verification status;
  - `docs/GAME_MASTER_CONTRACT.md` if prompt responsibilities, decision priorities, or GM input presentation notes are stale;
  - `docs/ARCHITECTURE.md` if prompt assembly ownership or GM orchestration wording is stale;
  - `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` if new GM prompt coverage rules were added;
  - `docs/EPICS.md` only if EPIC 8.3 is actually complete.

# Constraints

Respect:

- deterministic, consumer-oriented testing;
- existing test-tier suffix rules;
- no real-provider dependency in blocking tests;
- no documentation claim that exceeds verified implementation;
- no contract drift hidden behind prompt-only language changes.

# Deliverables

- complete regression coverage for EPIC 8.3 prompt refinement;
- verified compatibility with the existing GM runtime contract;
- successful relevant quality gates, with environment-gated suites reported accurately;
- synchronized source-of-truth documentation.

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

- `docs/GAME_MASTER_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] Tests protect the refined GM system prompt structure and dynamic input rendering structure.
- [ ] Tests prove the runtime contract remains compatible with existing parsing, normalization, and unlock validation.
- [ ] Tests prove scenario goals, memory, persona, and avatar availability still reach the GM prompt path when present.
- [ ] Tests prove empty-input session-start behavior remains supported.
- [ ] Tests prove GM diagnostics do not leak raw prompt or sensitive content.
- [ ] Relevant lint, typecheck, and test commands pass, with unavailable environment-gated suites clearly reported.
- [ ] `docs/PROJECT_STATUS.md` is updated and all impacted docs are accurate.
- [ ] EPIC 8.3 is marked complete only if every definition-of-done item is verified.
