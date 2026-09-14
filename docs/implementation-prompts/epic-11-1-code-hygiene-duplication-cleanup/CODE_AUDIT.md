# Code Audit — Code Hygiene & Duplication Reduction

## Scope audited

Audited the implementation described by `README.md` in this EPIC folder, including the complete
EPIC range from contract ownership through final hardening (`d56f3d94..HEAD`). Reviewed D1-D4 dead
code removal, R1-R7 consolidation, the current runtime/package graph, all required source-of-truth
documents, changed code and tests, package scripts, and the final repository state.

The audit also checked the current `docs/CODE_AUDIT.md` ownership record against the implementation.
The EPIC is cleanup-only: no new product behavior, endpoint, persistence schema, provider, or
runtime ordering was expected.

## Executive Summary

EPIC 11.1 was delivered. The four documented dead-code clusters were removed, the R1-R7 candidates
were either consolidated or given explicit keep-separate rationales, and the implementation remains
within the modular-monolith boundaries. The changes are focused and preserve the documented public
API, persistence ownership, provider ports, and Avatar/GM runtime ordering.

The cleanup has strong local evidence: the canonical helpers are small and readable, strict unused
checks pass for all TypeScript packages, stale references to D1-D4 symbols were not found, and the
uncached full deterministic test suite passes. The main residual risk is confidence, not a detected
runtime defect: `pnpm test:coverage` covers Core only, direct JSON-client contract tests exist for
admin but not console/web, and the exchange-window refactor is tested primarily at the helper rather
than both consuming use-case boundaries. A small amount of confirmed duplicate client/UI code also
remains by documented decision.

## Final Grade

**B — solid foundation with meaningful but bounded test and maintainability debt.**

An A is not justified because the EPIC changed shared/browser boundary code without equivalent
consumer-boundary tests across all affected clients, and the coverage command does not measure those
packages. This is not a release-blocking defect for the cleanup, but it is insufficient proof for an
“excellent, safe foundation” grade under the project’s test strategy.

## Build Health

- lint: PASS — `TURBO_FORCE=1 pnpm lint`, 7 Turbo tasks successful.
- typecheck: PASS — `TURBO_FORCE=1 pnpm typecheck`, 7 Turbo tasks successful.
- tests: PASS — uncached elevated `TURBO_FORCE=1 pnpm test`, 233 test files and 1,432 tests passed across six packages.
- coverage: PASS — `pnpm test:coverage`, Core only: 86.97% statements/lines, 83.77% branches, 96.61% functions.
- build: PASS — `TURBO_FORCE=1 pnpm build`, 6 package builds successful.
- strict unused check: PASS — `tsc --noEmit --noUnusedLocals --noUnusedParameters` for all six TypeScript packages.
- diff hygiene: the EPIC range is clean under `git diff --check`; the working tree was clean before this report.

The first uncached test attempt inside the sandbox failed only because the evaluation viewer tests
could not bind `127.0.0.1` (`listen EPERM`). The same uncached suite was rerun with loopback binding
enabled and passed, including all four viewer tests. This is recorded as an execution-environment
constraint, not a repository test failure.

## Feature Confidence Matrix

| Feature                              | Expected Behavior                                                                                                                                | Evidence                                                                                                | Confidence (High/Medium/Low) | Notes                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| D1-D4 dead-code removal              | Deleted modules are unreachable from runtime, scripts, tests, deployment, or documented entrypoints                                              | EPIC deletion commits, package/script search, stale-symbol search, strict typecheck, full tests         | High                         | 21 files removed; active ingestion, memory, context, and idempotency paths remain covered.                             |
| R3/R4/R7 Core cleanup                | Defaults, validation, embedding-profile comparison, visibility normalization, and signatures retain behavior while unused dependencies disappear | `api/composition.ts`, embedding/validation helpers, Core tests, strict unused check                     | High                         | Persistence-specific decoding and boundary error mapping remain separate as intended.                                  |
| R1 browser protocol ownership        | Admin, console, and web continue to normalize paths, authenticate, decode envelopes, and map errors                                              | Shared protocol tests; admin client tests; console/web clients consume shared helpers; full tests/build | Medium                       | Shared helper behavior is proven, but console/web JSON-client behavior is not directly tested at their own boundaries. |
| R2 operator mappers                  | Model-config and Avatar form values preserve trimming, omission, null clearing, and field names                                                  | Shared mapper tests; admin/console consumers; existing UI tests                                         | Medium                       | Pure mapping is proven; every affected form submission path is not independently asserted.                             |
| R5 exchange selection                | Complete user→Avatar pairs are ordered, bounded, and exclude incomplete/system turns                                                             | `conversation-exchange-window.test.ts`, active use of selector in memory and send-message paths         | Medium                       | The selector is well tested, but consuming use cases lack a regression test that proves the new wiring end to end.     |
| R6 timeout/stream/storage helpers    | Timeout cancellation, terminal stream recognition, and browser-storage fallback retain lifecycle semantics                                       | Timeout tests, web stream tests, storage tests, full suite                                              | High                         | Provider-specific status/error mapping and browser lifecycle remain local.                                             |
| Public/runtime contract preservation | No endpoint, schema, provider behavior, persistence ownership, or Avatar/GM ordering change                                                      | EPIC diff review, API/architecture/data docs, route and runtime tests, build/typecheck                  | High                         | No new endpoint, datastore, dependency, or compatibility path was introduced.                                          |

## Strengths

- The implementation followed the EPIC order and kept the diff focused: deletion, ownership,
  consolidation, then hardening/document synchronization.
- D1-D4 were removed as complete clusters, including tests that only kept retired designs alive;
  no compatibility aliases were added.
- Shared/public DTO ownership remains in `packages/shared`; Core domain and persistence types were
  not moved there merely to reduce textual similarity.
- Core composition stays in the API composition boundary, while provider timeout lifecycle stays in
  Infrastructure and browser stream/storage lifecycle stays in the web app.
- The exchange selector is a small pure application helper with deterministic ordering, complete
  pair semantics, empty-content preservation, fallback handling, and explicit caps.
- The new tests assert observable outputs and edge cases rather than private fields or mock-call
  counts alone. In particular, the stream tests cover chunk boundaries, malformed events, missing
  terminal events, and reader cancellation.
- Strict unused checks found no newly retained unused symbols across all six TypeScript packages.
- Existing health, diagnostics, provider wrappers, and bounded observability were not weakened by
  the cleanup.

## Findings

### Shared coverage does not cover the changed browser consumers

- Severity: Medium
- Category: Test coverage / boundary confidence
- Problem: `pnpm test:coverage` is defined as `vitest ... --filter=@gami/core`, so its 86.97% result
  excludes `packages/shared`, `apps/admin`, `apps/console`, and `apps/web`, even though R1/R2/R6
  changed shared and browser code.
- Why it matters: A green coverage report can appear to validate the EPIC while providing no
  coverage signal for the highest-change surfaces. Coverage is not proof, but absent coverage makes
  missing consumer behavior easier to overlook.
- Evidence: root `package.json` `test:coverage` script; `packages/shared/src/*protocol*.test.ts`,
  `apps/web/src/chat/message-stream-events.test.ts`, and browser client changes in the EPIC diff.
- Recommendation: Add an explicit workspace coverage command or package-level coverage jobs for the
  shared/browser cleanup scope, and report Core coverage separately from client coverage.

### Console and web JSON clients lack direct protocol contract tests

- Severity: Medium
- Category: Test quality / regression protection
- Problem: Shared protocol helpers are unit-tested and `apps/admin/src/api/client.test.ts` tests
  one concrete client, but the changed `apps/console/src/api/client.ts` and `apps/web/src/api/client.ts`
  do not have equivalent direct tests for URL construction, auth headers, envelope success/error
  handling, malformed JSON, and non-2xx fallback behavior.
- Why it matters: The three clients intentionally retain different method/header policies. Shared
  helper tests cannot prove that each consumer wires those policies correctly or that a later local
  edit does not bypass the canonical helper.
- Evidence: `apps/admin/src/api/client.test.ts` has the direct matrix; repository search finds no
  console/web client test files that invoke the real client functions.
- Recommendation: Add small boundary tests for console and web JSON clients, including their
  bodyless/header differences and the web binary/abort error path where applicable.

### R5 wiring is not proven at both consuming use-case boundaries

- Severity: Medium
- Category: Test quality / behavior regression
- Problem: `conversation-exchange-window.test.ts` proves the extracted selector, but the refactor
  also changed `GetSessionMemoryLayersUseCase` and Avatar send-message helper wiring. Existing tests
  do not explicitly assert the consumer-visible memory/dialogue result for unsorted history,
  incomplete pairs, empty user content, and caps after the new helper is invoked.
- Why it matters: A helper can be correct while a caller supplies the wrong limit, input shape, or
  output projection. The project test strategy requires proving the behavior required by the
  consumer, not only the utility implementation.
- Evidence: the new test targets only `conversation-exchange-window.ts`; the two callers are
  `get-session-memory-layers.use-case.ts` and `send-message.helpers.ts`.
- Recommendation: Add one deterministic use-case/consumer regression test per caller that asserts
  the returned short-term memory or LLM dialogue window, including the empty-content and cap cases.

### Evaluation tool retains duplicate API envelope guards outside the canonical helper

- Severity: Medium
- Category: Structural maintainability / contract ownership
- Problem: `tools/conversation-evaluation/src/core-api-client.ts` and `tools/conversation-evaluation/src/judge.ts`
  each implement a local `isApiResponseEnvelope` and error-shape predicate, while the EPIC establishes
  `packages/shared/src/api-client-protocol.ts` as the canonical protocol owner for the other clients.
- Why it matters: A change to envelope validity or error fields can now require updates in the shared
  clients and the evaluation tool independently. The evaluator is explicitly a public HTTP consumer,
  so this is contract drift risk even though its stricter response validators may remain tool-owned.
- Evidence: duplicate functions at `core-api-client.ts:255-266` and `judge.ts:163-173`; canonical
  helper at `packages/shared/src/api-client-protocol.ts:15-43`.
- Recommendation: Reuse the shared envelope/error guards and keep only evaluator-specific response
  validators and safe-message policy local, or document a concrete reason the evaluator must reject
  a different envelope domain.

### Byte-identical UI error formatters remain in admin and console

- Severity: Low
- Category: Duplication / maintainability
- Problem: `apps/admin/src/api/error.ts` and `apps/console/src/api/error.ts` are byte-identical
  implementations of `formatApiError`.
- Why it matters: A change to operator error presentation can silently diverge between the two
  surfaces. The current ownership matrix calls these UI-owned and intentionally separate, but the
  current code has no semantic difference supporting the separation.
- Evidence: direct file comparison shows identical imports and function bodies.
- Recommendation: Either move the format function to a small shared UI-neutral helper or add a short
  code-level rationale if the teams intentionally want independent operator copy ownership. Keep
  fallback strings and page-specific validation detail formatting local.

### Existing audit verification totals are stale

- Severity: Low
- Category: Documentation accuracy
- Problem: `docs/CODE_AUDIT.md:418` records 166 Core test files and 1,145 Core tests, while the
  current uncached `pnpm test` run reports 163 Core test files and 1,133 Core tests.
- Why it matters: Audit evidence is part of the supportability story. Stale counts reduce trust in
  the verification record and make later audits harder to compare.
- Evidence: current command output and the existing audit verification section.
- Recommendation: Replace hard-coded test totals with current values or report only the command and
  pass status; keep detailed counts in CI artifacts where possible.

## Architecture Review

The EPIC respects the documented `API -> Application -> Domain -> Infrastructure` direction. The
new Core composition helper is API-owned and only supplies test/local adapter defaults. Domain code
does not gain framework, provider, or browser dependencies. Provider adapters still depend on
provider-specific behavior only inside Infrastructure, with the timeout signal as the sole shared
speech lifecycle helper. Browser stream, binary, abort, and storage concerns remain in `apps/web`.

The shared package gains protocol guards and pure contract mappers, which aligns with the explicit
ownership added to `ARCHITECTURE.md` and `API_CONTRACT.md`. Persistence row decoding stays in
Postgres adapters, and domain/application entities were not collapsed into public DTOs. The GM
projection remains separate because it consumes an already bounded, timestamp-free context shape;
it is not an unexplained duplicate of the Avatar/session selector.

No controller orchestration, vendor leakage, datastore, endpoint, schema, migration, compatibility
layer, or runtime-order drift was found. Observability and health boundaries were preserved; the
EPIC does not add new operational signals because it does not add runtime behavior.

## Test Review

Strong tests:

- Shared protocol tests cover URL/path normalization, the health auth exception, valid/invalid
  envelopes, and client error runtime shape.
- Shared mapper tests cover trimming, omission, null clearing, and partial-value preservation.
- Exchange-window tests cover timestamp sorting, complete-pair filtering, system/incomplete turns,
  empty content, working-memory fallback, zero fallback, and trailing caps.
- Timeout tests cover timeout abort, caller cancellation without timeout classification, and timer
  cleanup.
- Web stream tests cover chunk boundaries, terminal handling, malformed events, missing completion,
  reader cancellation, and request forwarding. Existing higher-level runtime tests cover optimistic
  state, interruption cleanup, and completion reconciliation.
- Full Core route/application tests continue to cover active ingestion, memory, context, provider,
  health, diagnostics, and lifecycle paths after deletion.

Weak or implementation-coupled tests:

- Some consumer API tests mock `adminRequest`, `coreRequest`, or `webRequest` and assert call
  arguments. These are useful for endpoint path composition but do not prove the underlying HTTP
  protocol behavior; they should not be counted as client contract tests.
- The pure helper tests prove implementation outputs well, but the R5 callers are not separately
  proven at their consumer boundaries.
- Coverage percentage is healthy for Core but is not evidence for the browser/shared changes.

Missing tests:

- Direct console and web JSON-client protocol matrices.
- One consumer-level regression for each R5 caller.
- If the evaluation tool adopts the shared helper, a tool-level test proving its evaluator-specific
  validators still reject malformed response payloads while envelope decoding is shared.

No tests assert private fields, private methods, exact LLM prose, or mock call counts as the sole
proof of the cleanup behavior. The deleted tests were removed with the retired code, which avoids
false confidence from testing unreachable designs.

## Documentation Gaps

- The EPIC README, `EPICS.md`, `PROJECT_STATUS.md`, `ARCHITECTURE.md`, `API_CONTRACT.md`, and
  `TEST_STRATEGY.md` are aligned with the current ownership decisions and cleanup status.
- `DATA_MODEL.md`, `TECH_STACK.md`, and the Game Master/memory contract documents require no
  behavioral update because the EPIC did not change persistence, provider choices, memory semantics,
  or GM contracts. This is consistent with the EPIC’s documentation rules.
- `docs/CODE_AUDIT.md` should be corrected for the stale Core test totals identified above.
- The shared protocol ownership documentation should explicitly state whether the standalone
  conversation-evaluation tool is intentionally outside that helper, or the tool should consume it.
- The current coverage script should be documented as Core-only or expanded so its scope is not
  mistaken for whole-repository coverage.

## Path to A

Minimal steps:

1. Add direct protocol contract tests for console and web JSON clients, preserving their deliberate
   header/body differences.
2. Add consumer-level R5 regression tests for session memory-layer projection and Avatar dialogue
   assembly.
3. Resolve or explicitly document the evaluation-tool envelope guard ownership.
4. Correct the stale audit counts and make coverage scope explicit.
5. Optionally remove the byte-identical admin/console error formatter duplication if UI ownership
   does not require separate files.

## Final Recommendation

- **Close with debt.**

The EPIC is complete enough to close: all D1-D4 and R1-R7 decisions are implemented, the mandated
gates pass, and no architectural or runtime contract defect was found. Track the boundary-test,
coverage-scope, evaluation-client ownership, and stale-audit-evidence items as follow-up debt before
using this cleanup as the standard for an A-grade contract refactor.
