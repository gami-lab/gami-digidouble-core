# Code Audit — LLM Observability And Tracing

## Scope audited

This audit covers the current LLM tracing and observability architecture across the Core codebase, with emphasis on whether all LLM calls are reliably logged through the Langfuse-backed observability boundary.

Alignment was checked against:

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

- the `ILlmAdapter` port and provider adapters
- application use cases and services that call `llm.complete()`
- observability adapters and Langfuse integration
- composition roots and route wiring
- unit and route tests for LLM-backed flows

## Executive Summary

The codebase had a real architecture gap: LLM observability was not enforced at the LLM boundary. Some use cases emitted Langfuse traces manually, some emitted different custom events, and at least one LLM-backed path had no tracing around `llm.complete()` at all. That violated the project’s own replaceable-infrastructure and observability principles because the requirement to trace every LLM call was distributed across call sites instead of being guaranteed by the `ILlmAdapter` composition boundary.

The immediate symptom was correct: Langfuse visibility depended on which use case happened to remember to trace. The root cause was not a missing trace in one service, but the absence of a canonical observed LLM wrapper.

This audit drove a focused refactor:

- introduced a centralized observed LLM adapter wrapper
- moved completion/error tracing to the LLM adapter boundary
- removed duplicated completion tracing from `send-message`, `send-raw-message`, and `memory-maintenance`
- wired observed adapters through composition roots

That resolves the main architectural weakness. Remaining debt is smaller and mostly about strengthening proof and consistency around specialized domain traces.

## Final Grade

**B**

## Build Health

- lint: PASS (`pnpm lint`)
- typecheck: PASS (`pnpm typecheck`)
- tests: PASS (`pnpm test`)
- coverage: PASS (`pnpm test:coverage`)

## Feature Confidence Matrix

| Feature                       | Expected Behavior                                                                           | Evidence                                                                           | Confidence (High/Medium/Low) | Notes                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| LLM boundary tracing          | Every LLM call should emit an observability trace without relying on use-case-specific code | `ObservedLlmAdapter`, composition-root wiring, wrapper tests                       | High                         | Central guarantee now exists where previously there was none                                         |
| Send message flow             | Avatar turn completions should remain traced while preserving session context               | `SendMessageUseCase` request trace metadata + existing turn/event tests            | High                         | Call-site-specific trace helper removed; context now travels through request metadata                |
| Raw exchange flow             | Direct `/v1/exchange` completions should still be traced                                    | `SendRawMessageUseCase` trace context + observed adapter wrapper                   | High                         | Simpler use case, less duplication                                                                   |
| Memory maintenance compaction | Working-memory compaction LLM calls should be traced and errors captured                    | wrapper error/success behavior + `MemoryMaintenanceService` request trace metadata | High                         | No service-local observability code required anymore                                                 |
| GM LLM path                   | GM LLM completion failures should be traced and still surface GM-specific domain events     | GM request trace context + retained GM domain traces                               | Medium                       | Completion/error logging is centralized, but domain-event trace overlap should stay deliberate       |
| User fact extraction          | Any future production wiring through `ILlmAdapter` should inherit tracing automatically     | wrapper architecture + extractor depends only on `ILlmAdapter`                     | Medium                       | Architecture now protects this path even though production composition for extractor remains limited |

## Strengths

- The codebase already had a clean `ILlmAdapter` port, which made centralized enforcement possible without vendor leakage into application logic.
- Observability already had a dedicated port/adapter boundary, so the missing piece was composition, not a new subsystem.
- Most LLM call sites were already narrow and explicit, which kept the refactor small.
- Existing tests around send-message, GM flows, and memory maintenance gave enough behavioral coverage to refactor safely.

## Findings

### Observability is not enforced at the LLM abstraction boundary

- Severity: High
- Category: Architecture Quality / Observability
- Problem:
  `createLlmAdapter()` returned raw provider adapters with no tracing wrapper. That meant the `ILlmAdapter` abstraction did not guarantee observability.
- Why it matters:
  This breaks the project rule that important decisions must be measurable. It also creates silent regressions whenever a new LLM call site is added without duplicating trace code.
- Evidence:
  Raw adapters were created directly in infrastructure and route composition, while tracing lived in scattered application helpers.
- Recommendation:
  Keep observability attached to the LLM boundary via a canonical observed wrapper. New LLM call sites should pass optional context, not call `observability.trace()` manually for basic completion logging.

### Completion tracing was fragmented and inconsistent across use cases

- Severity: High
- Category: Code Quality / Maintainability
- Problem:
  `send-message`, `send-raw-message`, `memory-maintenance`, and GM error handling used different trace helpers and event names. Some flows traced completion, some traced only domain outcomes, and some had dedicated safety wrappers.
- Why it matters:
  Duplicated tracing logic drifts quickly. A future field change or tracing policy change requires multiple edits and guarantees uneven behavior.
- Evidence:
  `traceNonBlocking`, `traceSafe`, and direct `observability.trace()` usage existed in separate modules.
- Recommendation:
  Centralize raw completion/error logging in the observed LLM wrapper. Reserve call-site traces for domain-specific events only.

### At least one LLM-backed path had no completion trace at all

- Severity: High
- Category: Functional Completeness / Observability
- Problem:
  `LlmUserFactExtractor` called `llm.complete()` without any local tracing, so whether it was observed depended entirely on the injected adapter.
- Why it matters:
  This is exactly the failure mode the user reported: tracing coverage was accidental, not guaranteed.
- Evidence:
  The extractor used the raw `ILlmAdapter` directly with no accompanying observability call.
- Recommendation:
  Keep extractor code unchanged and rely on the observed adapter wrapper so this class stays clean while still being fully instrumented in production.

### Build health was already signaling local architecture friction

- Severity: Medium
- Category: Build Health / Maintainability
- Problem:
  The previous tactical memory-maintenance tracing patch introduced lint failures in `memory-maintenance.service.test.ts`.
- Why it matters:
  This is a concrete signal that adding more per-call observability code increases friction and maintenance overhead.
- Evidence:
  `pnpm lint` failed on max-lines-per-function and unbound-method in the test file before the wrapper refactor.
- Recommendation:
  Prefer centralized instrumentation and smaller behavioral tests over copying trace assertions into every use case.

### Specialized domain traces still need intentional ownership boundaries

- Severity: Low
- Category: Architecture Quality
- Problem:
  The codebase still has domain-level traces such as `gm.triggered` and `gm.invalid_output` in addition to raw LLM completion tracing.
- Why it matters:
  This is correct only if those traces represent domain outcomes, not another layer of raw completion logging.
- Evidence:
  GM event helpers emit observability events after parsing/decision logic, which is distinct from the wrapper’s completion/error traces.
- Recommendation:
  Keep these traces only where they describe domain semantics beyond raw completion. Avoid reintroducing duplicate `llm.completion`-style tracing outside the wrapper.

## Architecture Review

Before the refactor, the architecture was drifting from the documented principles:

- replaceable infrastructure existed in name, but the LLM abstraction did not enforce observability
- important measurement behavior depended on use-case discipline instead of adapter composition
- adding a new LLM call could silently bypass Langfuse

After the refactor, the design is materially stronger:

- `ILlmAdapter` remains the single LLM boundary
- provider adapters stay vendor-specific and focused only on provider communication
- observability is attached at composition time through a wrapper, preserving clean boundaries
- application code now passes optional trace context instead of duplicating trace emission logic

This is the correct direction for the modular monolith: business flows stay small, infrastructure cross-cutting concerns stay centralized.

## Test Review

Strong tests:

- existing send-message and memory-maintenance tests still prove consumer-visible behavior after tracing refactor
- new observed-adapter tests prove success tracing, error tracing, and failure isolation at the actual enforcement point
- send-raw-message tests now focus on request shaping and outward behavior rather than implementation-specific observability side effects

Weak tests:

- there is still limited direct proof that every composition root always injects an observed adapter rather than a raw one
- route-level tests do not explicitly assert Langfuse trace coverage for all LLM-backed endpoints

Missing tests:

- a focused composition test for `createLlmAdapter(config, observability)` returning the observed wrapper where expected
- a GM-path test that proves wrapper-based `gm.llm_error` coverage without depending on call-site traces

Implementation-coupled tests:

- the removed send-raw-message observability assertions were implementation-coupled because they tested local trace calls rather than guaranteed tracing behavior at the adapter boundary

## Documentation Updates

- `docs/ARCHITECTURE.md` now explicitly states that LLM observability is enforced by the observed adapter wrapper at composition time.
- `docs/PROJECT_STATUS.md` now records centralized LLM tracing ownership at the adapter boundary.
- `docs/TECH_STACK.md` now documents wrapper-based baseline Langfuse completion/error emission and `createLlmAdapter(config, observability)` composition.
- If there is an operations runbook for Langfuse, keep raw completion traces distinguished from domain-level traces such as `gm.triggered`.

## Path to A

1. Add one or two focused composition tests proving all production adapter construction paths use the observed wrapper when observability is configured.
2. Audit remaining domain-level observability events and make explicit which ones are raw completion traces versus domain outcome traces.
3. Add one regression test for a non-conversation LLM path, such as user-fact extraction or health-probe behavior under the observed adapter.

## Final Recommendation

**Close with debt**

The architecture problem was real, but it is now corrected at the right layer. I would not block ongoing work on this area, but I would keep the remaining proof/documentation work visible so future LLM integrations do not regress.

## Remediation Outcome

### Changes Made

- Added `ObservedLlmAdapter` as the canonical place for completion/error tracing.
- Extended `LlmRequest` with optional trace context so callers can provide session-aware metadata without direct observability calls.
- Updated LLM composition points to wrap provider adapters with observability.
- Removed duplicated completion tracing from send-message, send-raw-message, and memory-maintenance.
- Simplified tests accordingly and added wrapper-focused regression coverage.

### Findings Resolved

- Observability not enforced at the LLM boundary.
- Fragmented per-call completion tracing.
- Missing tracing coverage for generic `ILlmAdapter` consumers.
- Tactical tracing patch causing local lint friction.

### Findings Deferred

- Explicit composition-root tests proving observed adapter injection everywhere.

### Build Gates

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS
