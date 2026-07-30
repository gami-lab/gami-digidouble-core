# Code Audit — EPIC 8.6 Scripted Conversation Response Evaluation

## Scope audited

Audited the implementation in `tools/conversation-evaluation`, its shared-contract usage, the
opt-in Villa Miralac definition, the EPIC prompt pack, and all required project documents:

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

The audit covers the current checkout at commit `e69bb73a` and includes the EPIC README definition
of done plus prompt files 00–04.

## Executive Summary

EPIC 8.6 is substantially implemented and well isolated as an external HTTP client/tool. The
evaluator validates definitions, creates one session and conversation, runs ordered questions,
uses the authenticated raw-exchange boundary for judging, classifies API/judge/quality outcomes,
writes atomic reports, and provides an opt-in seeded example. The evaluator package has strong
deterministic coverage and its 42 tests pass.

The implementation is not yet an A-quality foundation. The current workspace cannot pass the
mandatory root checks because several package dependency links are incomplete (`@types/node` is
missing for Core and `vitest` is unavailable in the app packages). More importantly, the HTTP
client casts successful `ApiResponse<T>.data` values instead of validating the session,
conversation, Avatar-list, and full message contracts at runtime. The semantic tests also mostly
feed fabricated judge JSON directly into the parser; they do not prove that a valid judge failure
flows through `runEvaluation` into a failed question/report. Finally, judge latency and token
metadata is returned by the judge client but discarded before report persistence, limiting
operational comparison value.

## Final Grade

**C — acceptable but with meaningful weaknesses.**

The core workflow is delivered and the architecture is sound, but the contract-boundary and test
gaps are material for a tool whose purpose is trustworthy automated evaluation. The grade is also
capped below A because the mandatory workspace lint, typecheck, tests, and available coverage
command fail in the audited checkout.

## Build Health

- lint: **FAIL** — `pnpm lint` fails in `@gami/core` with cascading unresolved-type lint errors after missing Node typings; the evaluator package lint passes.
- typecheck: **FAIL** — `pnpm typecheck` fails in `@gami/core` with `TS2688: Cannot find type definition file for 'node'`; the evaluator package typecheck passes.
- tests: **FAIL** — `pnpm test` fails because `vitest` is not found in Core, web, console, and admin; the evaluator package passes **9 files / 42 tests**.
- coverage: **FAIL / unavailable for evaluator** — `pnpm test:coverage` fails because Core cannot resolve `vitest`; the evaluator package has no coverage script.
- formatting: **PASS** — `pnpm format:check` passes.
- evaluator-only build: **PASS** — package build, lint, typecheck, full tests, and integration-style test pass.

The root failures appear to be checkout dependency-linkage/environment failures rather than errors
introduced by the evaluator package, but they are still failures of the required commands and must
be resolved before a release-grade close.

## Feature Confidence Matrix

| Feature                           | Expected Behavior                                                                                                                                                      | Evidence                                                                                                                          | Confidence (High/Medium/Low) | Notes                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Definition loading and validation | Versioned JSON is loaded before network work; selectors, required fields, duplicate questions, unknown fields, and model metadata are validated.                       | `definition.test.ts`, `config.test.ts`, package README.                                                                           | High                         | CLI execution itself has no direct `runCli` test.                                                |
| Configuration and secret handling | CLI/environment precedence, URL/timeout validation, API-key sourcing, and run-scoped user IDs are safe.                                                                | `config.test.ts`, `cli.ts`, README.                                                                                               | Medium                       | Configuration functions are covered; the actual CLI process path is not.                         |
| Sequential Core execution         | One fresh session and conversation are reused; questions are sent in order and stop safely after an API failure.                                                       | `sequential-runner.test.ts` plus `evaluation.integration.test.ts` proving three-question ordering and judge-before-next-question. | High                         | The happy-path consumer behavior is convincingly proven with a fake HTTP boundary.               |
| Avatar response metrics and cost  | Avatar response, model, latency, token counts, and unavailable cost are retained without pricing inference.                                                            | `metrics.test.ts`, runner/report tests, integration report assertions.                                                            | Medium                       | Runtime response validation is incomplete; judge metrics are not retained.                       |
| Semantic judging                  | Raw exchange receives bounded structured evidence and validated machine-readable results; paraphrases, omissions, contradictions, and extra detail classify correctly. | `judge.test.ts` parser cases, raw-exchange request test, malformed/API error tests.                                               | Medium                       | The semantic cases mostly validate fabricated JSON, not end-to-end quality classification.       |
| Failure classification            | API errors, judge errors, and valid quality failures remain distinct.                                                                                                  | Error-classification tests and report aggregation.                                                                                | Medium                       | API and malformed-judge paths are covered; valid `passed: false` through `runEvaluation` is not. |
| Partial report persistence        | Each attempted question is retained and atomic JSON remains usable after partial execution/interruption.                                                               | `report.test.ts`, incremental snapshot assertions, API-error partial-run test.                                                    | Medium                       | No test writes an actual file across an abort/interruption path.                                 |
| Reporting and summary             | Per-question results, run summaries, model mismatches, nullable cost, and bounded console output are available.                                                        | `report.test.ts`, integration test, `README.md`.                                                                                  | High                         | Avatar metrics are present; judge latency/tokens are silently omitted.                           |
| Seeded scenario example           | A readable three-question Villa Miralac definition is opt-in and selects Clara by stable name.                                                                         | JSON fixture, definition test, seed README, package README.                                                                       | High                         | Live-provider execution remains intentionally unverified.                                        |

## Strengths

- The tool boundary is correctly outside the Core domain and infrastructure layers.
- The implementation uses `@gami/shared` HTTP contracts rather than copying Core entities or
  importing provider SDKs.
- Avatar execution is genuinely sequential and preserves one session/conversation, with a clear
  conservative stop after a possibly-committed failed request.
- The raw `/v1/exchange` boundary keeps judge provider selection behind Core's abstraction and
  preserves model-resolution ownership.
- Error categories are explicit in report types; a valid quality failure is not automatically
  converted into an infrastructure failure.
- Atomic replacement, bounded error messages, bounded judge input/output, and secret-free console
  rendering are good operational safeguards.
- Cost handling is honest: absent cost becomes `null`; no local pricing or token-based estimate is
  introduced.
- The fake-HTTP composition test verifies a real consumer-visible ordering invariant rather than
  only checking mock call counts.
- Documentation is unusually well synchronized for the new tool: architecture, stack, test
  guidance, EPIC status, project status, seed usage, and package usage are all updated.

## Findings

### Successful HTTP payloads are not fully runtime-validated

- Severity: High
- Category: Contract safety / boundary validation
- Problem: `CoreApiClient.decodeResponse` verifies only the outer envelope and then casts `data`
  to `T` (`core-api-client.ts:130-175`). Session creation, conversation creation, and Avatar-list
  payloads are consumed without runtime shape validation. The runner validates only a subset of
  message identity and metrics fields (`sequential-runner.ts:47-103`), and accepts finite negative
  metrics, empty models, and other semantically invalid values.
- Why it matters: A malformed or drifted successful response can produce undefined IDs in request
  paths, corrupt report data, or fail later as an opaque generic error. This undermines the EPIC's
  canonical-contract promise and makes API drift harder to diagnose.
- Evidence: `core-api-client.ts:82-87` checks only `data !== null`; `core-api-client.ts:174` uses
  `as T`; `sequential-runner.ts:186-199` reads bootstrap IDs without guards; no test covers a
  malformed successful bootstrap/message contract.
- Recommendation: Add small runtime guards for each consumed shared response at the client/runner
  boundary, including required IDs, Avatar list entries, message content, non-empty model, and
  non-negative finite metrics. Convert failures to a typed `contract_error` with the endpoint path,
  and add negative tests for malformed success payloads.

### Semantic quality behavior is under-proven by implementation-coupled tests

- Severity: High
- Category: Test quality / feature confidence
- Problem: Tests titled for paraphrases, missing criteria, contradictions, and additional information
  call `parseJudgeResult` with already-fabricated JSON (`judge.test.ts:38-120`). They prove the
  parser accepts a shape, not that the evaluator carries evidence to the judge and maps a valid
  `passed: false` result into a failed question and report.
- Why it matters: The EPIC's highest-value behavior is semantic evaluation. A regression in
  `judgeQuestion`, status mapping, or report aggregation could pass the current semantic tests.
  Coverage counts would therefore overstate confidence.
- Evidence: `evaluation.test.ts:223-237` covers malformed judge output only; `report.test.ts:55-65`
  constructs `QuestionResult` values directly; the integration fake returns `passed: true` for all
  three questions.
- Recommendation: Add a deterministic fake-judge HTTP test returning a valid `passed: false`
  result with missing elements/contradictions and assert `runEvaluation` emits `failed`, keeps the
  judge result, increments `failed`, and computes the expected pass-rate denominator. Keep parser
  tests as contract tests, but do not treat them as semantic-flow proof.

### Judge latency and token metadata is collected then discarded

- Severity: Medium
- Category: Observability / reporting completeness
- Problem: `SemanticJudgeClient.evaluate` returns `latencyMs`, `inputTokens`, and `outputTokens`
  (`judge.ts:38-44`, `judge.ts:357-364`), but `judgeQuestion` stores only the result and model
  (`evaluation.ts:52-63`). `QuestionResult`, `RunSummary`, and the JSON report therefore contain
  Avatar metrics but no judge timing or token usage.
- Why it matters: Evaluator runs incur judge cost and latency, and the project explicitly values
  measurable latency/token usage. The discarded fields make total run cost/time comparisons and
  judge-operability analysis incomplete, while also leaving misleading dead data in the client API.
- Evidence: `contracts.ts:16-25` has only `EvaluationMetrics` for Avatar results; `contracts.ts:67-78`
  has `judgeModel` but no judge metrics; `report.ts:47-59` aggregates only `result.metrics`.
- Recommendation: Either persist a clearly named nullable `judgeMetrics` object and aggregate it,
  or remove the unused fields and document that only Avatar metrics are in scope. The preferred
  option is to retain judge latency/tokens, while keeping judge cost unavailable unless the raw
  exchange contract supplies it.

### Operational error context is reduced too aggressively

- Severity: Medium
- Category: Supportability / debuggability
- Problem: Typed errors retain `path` and `kind`, but `toEvaluationError` drops `path` and report
  errors expose only kind, message, code, and optional status (`evaluation.ts:30-43`; `contracts.ts:39-44`).
  A generic `INVALID_RESPONSE` or `INTERNAL_ERROR` therefore does not identify whether bootstrap,
  Avatar message, or judge exchange failed.
- Why it matters: Operators are left to infer the failing phase from partial question state. This
  slows diagnosis and makes local report artifacts less useful during intermittent API failures.
- Evidence: `CoreApiError.path` and `JudgeClientError.path` exist (`core-api-client.ts:29-50`,
  `judge.ts:48-70`) but are never copied into `EvaluationError`.
- Recommendation: Add a bounded `path` or explicit `phase` field to the tool-owned error contract,
  preserve it in reports and summaries, and test that it remains free of secrets and unbounded data.

### Partial-report durability is not tested through the real writer during interruption

- Severity: Medium
- Category: Test quality / resilience
- Problem: Incremental writes are asserted using an in-memory `writeReport` callback, while the
  filesystem test writes one report successfully. No test aborts a run and then reads the actual
  output file to prove completed results and the failed/aborted question survive atomic replacement.
- Why it matters: The user-facing guarantee is a durable partial JSON artifact, not merely that an
  internal callback received snapshots. Interruptions are exactly where file-write and state-order
  bugs tend to appear.
- Evidence: `evaluation.test.ts:204-221` injects a mocked writer; `report.test.ts:100-118` tests a
  single successful write; the only process interruption wiring is in `cli.ts:29-46`.
- Recommendation: Add one deterministic abort/API-failure test using a temporary real output path,
  assert the final JSON parses, completed results are retained, status/error is classified, and no
  temporary file remains.

## Architecture Review

The architecture is directionally strong.

- API boundary: the evaluator consumes public authenticated HTTP routes and does not add a Core
  route.
- Application/domain boundary: the evaluator's runner, judge, aggregation, and report concerns are
  tool-owned and do not leak into Core's application or domain modules.
- Infrastructure replacement: `fetch` is injected for deterministic tests; provider adapters remain
  behind Core's `/v1/exchange` boundary.
- Contract ownership: Core HTTP DTOs remain in `packages/shared`; evaluation-only report types live
  in the tool. The local runtime guards are appropriate in principle, but they are incomplete and
  currently do not provide full protection against wire drift.
- Async behavior: the tool waits only for the synchronous Avatar response and judge response; it
  does not poll Game Master or memory work and therefore preserves the runtime's non-blocking
  behavior.

No architecture drift, provider leakage, new endpoint, Core persistence, or unjustified abstraction
was found. The main architectural concern is boundary robustness rather than layer placement.

## Test Review

### Strong tests

- `evaluation.integration.test.ts` proves three ordered questions, one session/conversation, auth
  headers, request bodies, and judge completion before the next Avatar request.
- `sequential-runner.test.ts` covers direct/name Avatar selection, ambiguity, ordering, identity,
  metrics normalization, and partial API failure.
- `core-api-client.test.ts` covers envelope errors, auth errors, timeout, abort, URL normalization,
  and bounded error messages.
- `report.test.ts` covers pass-rate denominator, nullable cost, atomic JSON writing, and bounded
  console output.
- Definition/config tests cover unknown fields, duplicate questions, selector rules, safe secrets,
  and run-scoped IDs.

### Weak or implementation-coupled tests

- Parser tests are useful contract tests but are labeled as semantic behavior tests when they only
  accept fabricated judge results.
- Report aggregation tests construct `QuestionResult` objects directly, so they do not prove the
  full runner → judge → report workflow.
- The integration fake's judge always passes; it cannot catch a regression in valid quality-failure
  mapping.

### Missing tests

- Malformed successful session, conversation, Avatar-list, and message payloads.
- Valid judge `passed: false` flowing through `runEvaluation`.
- Real-file partial report after abort/interruption.
- Direct `runCli` behavior, including non-zero outcomes and safe console/error output.
- Non-negative/required-value enforcement for response metrics and model identifiers.

## Documentation Gaps

The required documentation is largely synchronized. The following were verified as accurate or
appropriately unchanged:

- `API_CONTRACT.md` correctly documents that raw exchange does not guarantee cost; no route changed.
- `DATA_MODEL.md` needs no change because reports are local tool artifacts, not Core persistence.
- `VISION.md` and `PRINCIPLES.md` require no feature-specific edits; the tool supports their API-first,
  LLM-agnostic, measurable, and lean-core direction.
- Architecture, stack, EPIC, project status, test strategy, coverage plan, seed README, and tool
  README were updated.

Recommended documentation follow-up is to document whether judge latency/tokens are intentionally
excluded from reports and to document CLI exit-code behavior for valid quality failures versus
infrastructure failures.

## Path to A

Minimal steps:

1. Repair workspace dependency installation/linkage so `pnpm lint`, `pnpm typecheck`, `pnpm test`,
   and `pnpm test:coverage` pass from a clean checkout.
2. Add runtime guards for all consumed successful HTTP payloads and bounded contract-error context.
3. Add an end-to-end evaluator test for a valid quality failure and a real-file interruption/partial
   report test.
4. Decide and implement the judge telemetry contract: persist judge latency/tokens or remove the
   unused return fields and explicitly scope observability to Avatar responses.
5. Preserve error phase/path in reports and add a small `runCli` test suite.

## Final Recommendation

- **Close EPIC with debt**

The requested workflow is usable and the evaluator package is well structured, so a full rework is
not warranted. Close only with the findings recorded as follow-up debt, and do not call the EPIC an
A-quality foundation until the workspace checks and the contract/test/observability gaps above are
resolved.
