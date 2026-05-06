# Code Audit — EPIC 4.2b Memory System v2

## Scope audited

This audit covers EPIC 4.2b Memory System v2 as defined in:

- docs/implementation-prompts/epic-4-2b-memory-system-v2/README.md

And alignment against:

- docs/VISION.md
- docs/PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/TECH_STACK.md
- docs/DATA_MODEL.md
- docs/API_CONTRACT.md
- docs/TEST_STRATEGY.md
- docs/TEST_COVERAGE_PLAN.md
- docs/EPICS.md
- docs/PROJECT_STATUS.md

Code and behavior were evaluated across:

- layered memory domain contracts
- working-memory persistence and repositories
- async memory maintenance flow
- avatar turn-time memory assembly
- GM memory context integration
- admin memory inspection routes
- related tests (unit, route, integration, stack-e2e where available)

## Executive Summary

EPIC 4.2b is substantially delivered and operationally healthy. The implementation respects modular monolith boundaries and keeps memory concerns mostly in application/domain services behind explicit repository ports. Core behavior is in place: bounded short-term memory for Avatar and GM context assembly, working-memory persistence at session and avatar levels, non-blocking maintenance triggers, and admin inspection surfaces.

Build health is strong (lint, typecheck, test, coverage all pass), and the test suite demonstrates many consumer-visible behaviors.

Main weaknesses are not in baseline functionality, but in maintainability and test depth for some critical read-model paths:

- important memory policy constants are duplicated across modules
- one key memory summary use case has very weak direct behavioral coverage
- admin long-term memory layer is currently unbounded, with potential payload/operability risk at scale
- memory maintenance policy is embedded in string heuristics rather than a domain policy contract

This is close-ready, but not A-grade yet.

## Final Grade

**B**

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage`)
  - apps/core summary: Statements 91.32%, Branches 86.23%, Functions 97.74%, Lines 91.32%

## Feature Confidence Matrix

| Feature                                          | Expected Behavior                                                                       | Evidence                                                                                                | Confidence (High/Medium/Low) | Notes                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Canonical layered memory contracts               | Shared typed memory model reused across Avatar + GM flows                               | domain memory types + GM input integration + prompt assembly wiring                                     | High                         | Contracts are explicit and mostly coherent across domain/application/shared DTOs                         |
| Working-memory persistence                       | Session and avatar working summaries persisted and retrievable                          | `session_memories` / `avatar_session_memories` schema + Postgres/in-memory repositories + tests         | High                         | Upsert and isolation behaviors covered                                                                   |
| Async memory maintenance                         | Refresh happens after turns and conversation close without blocking response            | `MemoryMaintenanceService` + fire-and-forget calls from send/end use cases + event log lifecycle events | High                         | Non-blocking behavior present and failure path does not crash turns                                      |
| Deterministic turn-time memory assembly (Avatar) | Last 2 exchanges + working memory + bounded long-term facts injected into avatar prompt | `AvatarMemoryContextAssembler` + persona prompt memory rendering + unit tests                           | High                         | Strong consumer-behavior assertions for short-term/working/long-term shaping                             |
| GM memory awareness                              | GM receives bounded layered memory context via shared assembly logic                    | `RunGameMasterUseCase` memory input path + targeted memory-input unit test                              | Medium                       | Happy path covered; deeper negative/boundary variants can be expanded                                    |
| Admin memory inspection                          | Compact summary endpoint + layered endpoint provide operator-readable memory state      | `admin-memory` routes + unit tests + stack-e2e auth/shape tests                                         | Medium                       | Behavior exists and tested, but long-term facts in layered endpoint are unbounded                        |
| Reset semantics with memory                      | Reset clears short-term/working memory and preserves long-term user facts               | `ResetSessionUseCase` + tests + data model alignment                                                    | Medium                       | Core behavior present; additional explicit operator-facing assertions could harden regression protection |

## Strengths

- Architecture boundaries are largely respected:
  - API routes remain orchestration entrypoints, not business-rule containers.
  - Memory behavior is encapsulated in use cases/services and repository ports.
- Replaceable infrastructure is maintained through ports/adapters for memory repositories and event log.
- Async-by-default principle is applied correctly for memory maintenance and user-fact extraction.
- Memory v2 contracts materially reduce prior drift by centralizing layered memory types.
- Test suite is broad and fast, and quality gates are green.

## Findings

### 1. Memory policy constants are duplicated across modules

- Severity: Medium
- Category: Structural Maintainability
- Problem:
  - Core memory bounds are repeated as local constants in multiple services/use cases (`2`, `10`, `20`, etc.).
  - Short-term exchange count and long-term fact limits are not owned by one policy module.
- Why it matters:
  - Raises drift risk when policies evolve.
  - A policy change can require multiple manual edits across application services and use cases.
- Evidence:
  - Multiple independent constant declarations and slices in memory assembly paths.
- Recommendation:
  - Introduce a single memory-policy module (domain-level constants/config) and consume it everywhere (Avatar assembler, GM assembly, admin layers, maintenance where relevant).

### 2. Key memory summary use case has weak direct behavioral test coverage

- Severity: Medium
- Category: Test Quality
- Problem:
  - `GetSessionMemoryUseCase` shows very low direct coverage (20%), with most confidence currently coming from route tests.
  - Boundary and failure-mode behavior at use-case level is under-specified.
- Why it matters:
  - Endpoint-level tests are valuable but can miss nuanced logic regressions inside the use-case.
  - Weak direct coverage on a memory read model increases refactor risk.
- Evidence:
  - Coverage output flags low coverage for `application/use-cases/get-session-memory/get-session-memory.use-case.ts`.
- Recommendation:
  - Add focused unit tests covering:
    - dedicated working-memory precedence over legacy mirror
    - fallback behavior when dedicated row missing
    - long-term fact count presence/absence and repository error handling
    - timestamp source precedence

### 3. Admin layered long-term facts are unbounded

- Severity: Medium
- Category: Operational Quality / API Maintainability
- Problem:
  - Layered admin response currently maps all long-term facts for a user without explicit cap.
- Why it matters:
  - Response size and latency can degrade over time.
  - Operator UX and endpoint stability can regress under high-memory users.
- Evidence:
  - `GetSessionMemoryLayersUseCase` maps all facts directly into response.
- Recommendation:
  - Add explicit bounded default (for example 50) with optional pagination/limit query in admin route contract.
  - Document bound in API and DATA_MODEL docs.

### 4. Working-memory summarization policy is embedded in string heuristics

- Severity: Medium
- Category: Code Quality / Domain Modeling
- Problem:
  - `MemoryMaintenanceService` directly builds summary strings (`buildSessionSummary`, `buildAvatarSummary`) in application service logic.
  - Policy is not owned by a dedicated domain abstraction.
- Why it matters:
  - Summarization behavior becomes harder to evolve/test independently.
  - Format drift can break downstream prompt behavior without clear contract ownership.
- Evidence:
  - Summary-generation helper functions live in the maintenance service and are coupled to persistence updates.
- Recommendation:
  - Extract summary policy to a dedicated domain service/port with explicit contract and test matrix.

### 5. Limited explicit regression tests for memory refresh event quality

- Severity: Low
- Category: Observability / Test Quality
- Problem:
  - Event lifecycle tests validate presence of success/failure event types, but less strongly validate payload contract stability over time.
- Why it matters:
  - Event consumers (operators/debug tooling) rely on stable semantics and fields.
  - Silent payload drift reduces debuggability.
- Evidence:
  - Existing tests focus primarily on event type emission and non-throwing behavior.
- Recommendation:
  - Add contract-level assertions for key payload fields (`trigger`, ids, summary lengths/message counts, error shape) and correlation propagation.

## Architecture Review

The EPIC implementation is architecturally solid overall:

- Modular monolith boundaries:
  - Preserved. Memory logic sits in domain/application services and repository ports.
- API/Application/Domain/Infrastructure separation:
  - Mostly clean. API routes compose use cases; persistence remains adapter-based.
- Business logic in controllers:
  - No major drift observed. Controllers are thin.
- Vendor leakage:
  - None observed in domain memory logic.
- Ports/adapters usage:
  - Strong for repositories and maintenance trigger boundaries.
- Async usage:
  - Correctly used for post-turn and conversation-close maintenance; response path remains non-blocking.

Architecture debt exists mainly around policy centralization and summary abstraction, not boundary collapse.

## Test Review

Strong tests:

- `AvatarMemoryContextAssembler` tests assert consumer-visible behavior (exactly last 2 exchanges, working-memory scoping, bounded long-term facts, graceful degradation).
- `MemoryMaintenanceService` tests verify non-blocking/failure-safe behavior and row update semantics.
- `RunGameMasterUseCase` memory-input test validates actual memory payload visible to GM consumer contract.
- Admin memory route tests cover auth, not-found, summary precedence, and layered shape.

Weak tests:

- `GetSessionMemoryUseCase` is weakly covered directly.
- Event payload contract assertions for memory refresh lifecycle can be stronger.

Missing tests:

- Explicit bounds/pagination behavior for admin layered long-term facts (not currently implemented).
- Centralized policy-regression tests (because policy is not yet centralized).

Implementation-coupled tests:

- Limited issue overall. Most checked tests are behavior-oriented.
- Some event tests remain somewhat implementation-near (type-only assertions) and should assert contract fields more strictly.

## Documentation Gaps

Docs are largely aligned and up to date for EPIC scope. Gaps to close:

- Add explicit operator/API bound policy for layered long-term facts in:
  - docs/API_CONTRACT.md
  - docs/DATA_MODEL.md
- Document centralized memory policy ownership once constants are consolidated.
- Add a short runbook note for interpreting `memory_refresh_failed` rates in operations docs (if available).

## Path to A

Minimal steps needed to reach A:

1. Centralize memory policy constants (short-term window, long-term cap, message fetch limits) into one owned module and replace duplicated literals.
2. Add focused unit tests for `GetSessionMemoryUseCase` to raise confidence on precedence/fallback/error semantics.
3. Add bound or pagination for admin long-term facts in memory-layers endpoint, with route tests and doc updates.
4. Extract working-memory summary generation into a dedicated policy service with explicit tests.
5. Tighten event payload contract tests for memory refresh lifecycle and correlation propagation.

## Final Recommendation

**Close with debt**

EPIC 4.2b is functionally delivered, architecturally coherent, and build-healthy. Remaining issues are meaningful but tractable maintainability/test-hardening items that should be tracked as follow-up debt rather than blocking closure.
