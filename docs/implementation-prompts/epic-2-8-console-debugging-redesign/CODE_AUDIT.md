# Code Audit — EPIC 2.8 Console Debugging Redesign (Cleanup-First)

## Scope audited

- EPIC scope source: `docs/implementation-prompts/epic-2-8-console-debugging-redesign/README.md`
- Console implementation reviewed:
  - `apps/console/src/App.tsx`
  - `apps/console/src/pages/DebugShellPage.tsx`
  - `apps/console/src/pages/debug-shell-navigation.ts`
  - `apps/console/src/components/RuntimeInspector.tsx`
  - `apps/console/src/components/runtime-inspector-tab-content.tsx`
  - `apps/console/src/components/memory-evolution.ts`
  - `apps/console/src/components/gm-impact-trace.ts`
  - `apps/console/src/components/turn-profiler.ts`
  - associated tests under `apps/console/src/**`
- Build gates executed:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:coverage`
- Alignment references consulted:
  - `docs/PRINCIPLES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TEST_STRATEGY.md`
  - `docs/PROJECT_STATUS.md`

## Executive Summary

EPIC 2.8 implementation is largely present and coherent: the console now routes through a unified Debugging Shell with focused sections (session setup, memory, GM impact, turn profiler, persona), and key supporting modules/tests exist for memory deltas, GM causality traces, and turn profiling behavior.

However, the EPIC cannot be considered release-safe at this moment because mandatory build health is not green: typecheck fails in core on `stream-runtime-events.test.ts` (TS2493 tuple index error). This is a hard quality gate failure and blocks an A grade and close-readiness under the audit model.

## Final Grade

**C**

Rationale: meaningful delivery and good structure, but one critical build gate failure plus minor documentation/test-quality risks.

## Build Health

- lint: **PASS**
- typecheck: **FAIL**
  - `apps/core/src/api/routes/stream-runtime-events.test.ts(218,41): error TS2493: Tuple type '[]' of length '0' has no element at index '0'.`
- tests: **PASS**
  - core: 84 files, 497 tests passed
  - console: passing (from full workspace run)
- coverage: **PASS (available)**
  - unit coverage command completes successfully (core snapshot remains above configured thresholds)

## Feature Confidence Matrix

| Feature                                 | Expected Behavior                                                 | Evidence                                                                                                                                                                             | Confidence (High/Medium/Low) | Notes                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Unified debugging shell and nav pruning | One primary debug path with sectioned shell and simplified entry  | `apps/console/src/App.tsx`, `apps/console/src/pages/DebugShellPage.tsx`, `apps/console/src/pages/debug-shell-navigation.ts`, `apps/console/src/pages/debug-shell-navigation.test.ts` | High                         | Legacy pages listed as removed in project status; shell entry is active.                                       |
| Memory evolution workspace              | Operators can inspect layered memory and changes across snapshots | `apps/console/src/components/memory-evolution.ts`, `apps/console/src/components/runtime-inspector-tab-content.tsx`, `apps/console/src/components/memory-evolution.test.ts`           | High                         | Delta logic and bounded history are covered by focused tests.                                                  |
| GM impact causality trace               | Trace GM trigger/decision/impact using event correlation          | `apps/console/src/components/gm-impact-trace.ts`, `apps/console/src/components/gm-impact-trace.test.ts`, runtime inspector tab rendering                                             | High                         | Causality mapping exists and is tested.                                                                        |
| Turn profiler latency breakdown         | Expose turn latency/tokens with filtering and sorting             | `apps/console/src/components/turn-profiler.ts`, `apps/console/src/components/turn-profiler.test.ts`                                                                                  | High                         | Behavior-oriented tests cover filtering/sorting/formatting.                                                    |
| Persona-first start flow                | Persona must be saved/ready before session start                  | `apps/console/src/pages/DebugShellPage.tsx`, `apps/console/src/components/ScenarioSessionLauncher.test.tsx`                                                                          | Medium                       | Gate exists and has partial test evidence; integration of full shell persona-start journey should be stronger. |
| Cleanup-first contract/path maintenance | Remove duplicate/obsolete debug surfaces without contract drift   | `docs/PROJECT_STATUS.md`, absence of removed files under `apps/console/src/pages`                                                                                                    | Medium                       | Cleanup appears done; current typecheck failure in core weakens overall EPIC hardening claim.                  |

## Strengths

- Clear cleanup-first delivery direction reflected in code structure and navigation simplification.
- Good decomposition into reusable transformation modules (`memory-evolution`, `gm-impact-trace`, `turn-profiler`).
- Test suite includes focused behavior checks for newly introduced console logic.
- Contract ownership intent remains aligned with shared DTO strategy from prior EPIC work.

## Findings

### 1) Core typecheck gate is broken

- Severity: Critical
- Category: Build Health / Quality Gate
- Problem: `pnpm typecheck` fails due to tuple indexing in stream event route test.
- Why it matters: Failing typecheck breaks mandatory CI signal and invalidates EPIC hardening/closure quality claims.
- Evidence: `apps/core/src/api/routes/stream-runtime-events.test.ts(218,41) TS2493`.
- Recommendation: Fix mock call typing/assertion in `stream-runtime-events.test.ts`, rerun full gates, and block EPIC closure until green.

### 2) Project status claims hardening completion while current gate is red

- Severity: High
- Category: Documentation Alignment / Governance
- Problem: `docs/PROJECT_STATUS.md` marks EPIC 2.8 complete and states full hardening pass, but current workspace typecheck fails.
- Why it matters: Governance signal becomes unreliable and may hide real release risk.
- Evidence: EPIC 2.8 completion + hardening wording in `docs/PROJECT_STATUS.md` versus failing `pnpm typecheck` output.
- Recommendation: Update status wording or immediately restore build green and re-verify before keeping “complete/hardened” claims.

### 3) Persona-first confidence is not fully proven end-to-end in shell flow

- Severity: Medium
- Category: Test Quality
- Problem: Persona gate behavior is present, but test emphasis appears stronger on component-level rendering than full shell/operator journey assertions.
- Why it matters: Regressions in state transitions (load persona -> save persona -> start session unlock) may slip despite local green tests.
- Evidence: Gate logic in `apps/console/src/pages/DebugShellPage.tsx`; related test exists in `apps/console/src/components/ScenarioSessionLauncher.test.tsx`.
- Recommendation: Add a behavior-focused UI-level test around `DebugShellPage` validating blocked start before save and allowed start after successful save.

### 4) Cross-package gate ownership is fragile for console-only EPIC closure

- Severity: Medium
- Category: Delivery Process
- Problem: A console EPIC closure depends on whole-monorepo typecheck/tests; unrelated breakages can invalidate closure timing and confidence.
- Why it matters: Teams may mark feature complete despite failing shared gates, creating drift between delivery and readiness.
- Evidence: Console implementation/tests pass while core typecheck currently fails.
- Recommendation: Keep whole-repo gate as blocker, but add explicit “closure checklist” artifact in EPIC folder that records package-level and workspace-level states.

### 5) Some tests remain implementation-near instead of pure consumer-observable assertions

- Severity: Low
- Category: Test Design
- Problem: A few tests assert direct mapping/details that are close to implementation structure (for example static section mapping).
- Why it matters: Such tests can pass while user-observable behavior regresses elsewhere.
- Evidence: `apps/console/src/pages/debug-shell-navigation.test.ts` focuses mapping continuity; valuable but limited user-journey assurance.
- Recommendation: Complement mapping/unit tests with interaction-level tests through page shell transitions and visible operator outputs.

## Architecture Review

- EPIC 2.8 changes are primarily console/UI-side and do not introduce API-layer architectural drift in core modules.
- Console composition remains consistent with modular boundaries: API calls in API helpers, derived behavior in dedicated utility modules, and rendering in page/component layer.
- No evidence in this slice of vendor leakage into domain or cross-layer shortcutting.
- Risk note: build instability in core test typing is not an architecture violation but still undermines maintainability confidence.

## Test Review

Strong tests:

- `apps/console/src/components/memory-evolution.test.ts` validates meaningful memory delta behavior.
- `apps/console/src/components/gm-impact-trace.test.ts` validates causality grouping logic.
- `apps/console/src/components/turn-profiler.test.ts` validates filtering/sorting and output descriptors.

Weak tests:

- `apps/console/src/pages/debug-shell-navigation.test.ts` is useful but narrow; mostly structural mapping confidence.

Missing tests:

- Full shell persona-first transition: blocked-start before save and successful-start after save in one flow.
- Optional negative-path UI behavior for failed persona load/save retries in shell flow.

Implementation-coupled tests:

- Section-to-tab mapping tests are partly implementation-near and should be complemented by operator-visible behavior assertions.

## Documentation Gaps

- `docs/PROJECT_STATUS.md` likely needs immediate reconciliation with current build state (typecheck fail) before maintaining EPIC closure/hardening claims.
- If typecheck fix is applied, include the specific fix and revalidated gate outputs in status notes for traceability.

## Path to A

Minimal steps required:

1. Fix `apps/core/src/api/routes/stream-runtime-events.test.ts` typing issue (TS2493).
2. Rerun and capture clean outputs for `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage`.
3. Add one behavior-first test for persona-first session-start gate through Debugging Shell flow.
4. Reconcile/update `docs/PROJECT_STATUS.md` to reflect verified build state.

## Final Recommendation

**Rework before close**.

Feature work is substantially delivered, but EPIC should not be closed as fully hardened while the required typecheck gate is failing.
