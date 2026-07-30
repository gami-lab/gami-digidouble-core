# Add Semantic Judging and Structured Reporting

## Context

The runner now produces ordered Avatar responses and runtime metadata. This slice evaluates each
response against its expected criteria and turns the execution into a durable JSON report that can
be compared across runs.

The current Core already exposes an authenticated raw exchange route. Use it as the judge boundary
so the tool remains provider-agnostic and does not duplicate the internal LLM adapter layer. A
judge failure is an infrastructure/evaluation error, not proof that the Avatar response is wrong.

## Scope

In scope:

- implement a judge client using authenticated `POST /v1/exchange` with a bounded system prompt and
  structured input containing the question, expected response criteria, and actual Avatar response;
- require a machine-readable judge result with `passed`, integer `score` from 1–5, short `reason`,
  `missingElements`, and `contradictions`;
- validate judge output at runtime, reject malformed/ambiguous output as `judge_error`, and support
  a bounded fenced-JSON normalization only if it is deterministic and tested;
- keep judge model metadata separate from Avatar model metadata and surface declared/effective
  mismatches without silently changing server configuration;
- produce per-question results containing source texts, actual response, observed model, API metrics,
  judge result or classified error, and safe error details;
- produce run-level summary totals, pass rate, response-time/token aggregates, observed models,
  session/conversation IDs, execution timestamps, and nullable cost semantics;
- write valid JSON after each completed/failed question when an output path is configured so an
  interrupted process leaves a usable partial report;
- print a concise console summary after completion or interruption.

Out of scope:

- direct provider SDK calls or Langfuse access; public-price estimates remain evaluator-owned and
  explicitly separate from API-reported cost;
- exact-string response grading;
- human review workflows, dashboards, CI scheduling, or historical database storage;
- automatic retries that could duplicate conversation turns;
- changing `/v1/exchange` without updating its existing contract tests/docs. The additive model
  selection field is now supported by the raw exchange and conversation message contracts.

## Relevant Docs

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
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md`
- `apps/core/src/api/routes/exchange.ts` — raw judge boundary and request limits
- `apps/core/src/api/routes/exchange.stack-e2e.test.ts` — raw exchange envelope/auth behavior
- `docs/implementation-prompts/epic-8-6-scripted-conversation-response-evaluation/01-tool-foundation-and-definitions.md`
- `docs/implementation-prompts/epic-8-6-scripted-conversation-response-evaluation/02-sequential-conversation-runner.md`

## Implementation Guidance

- Keep judge instructions stable and explicit: semantic equivalence, valid paraphrases, essential
  omissions, contradictions, relevance, and no rejection solely for additional relevant detail.
- Serialize judge inputs in a bounded, unambiguous format. Respect the existing raw-exchange body
  limits; if the combined judge payload cannot fit, record a `judge_error` rather than silently
  truncating evidence.
- Treat `passed` and `score` as judge output, not deterministic local heuristics. Validate score
  bounds, array element types, and non-empty reason; preserve empty arrays as empty arrays.
- Distinguish these states: `api_error` (Avatar request failed), `judge_error` (judge unavailable or
  malformed), `passed`, and `failed` (valid judge result with `passed: false`). Do not convert a
  judge error into a quality failure.
- Define aggregation explicitly. `questions` is the definition length; `evaluated` counts valid
  judge results; `passRate` is `passed / evaluated` and is `null` when no question was evaluated.
  Aggregate Avatar timing/tokens over successful Avatar responses. Set total cost to `null` unless
  the report's cost policy can prove the total is complete; never treat missing cost as zero.
- Use atomic replacement or an equivalent safe write strategy for the output file. Do not leave a
  half-written JSON document if the process is interrupted during a write.
- Console output should show test name, declared/observed models, each question's status and score,
  key metrics, and summary counts without printing API keys, system prompts, or unbounded payloads.

## Constraints

- Use only existing authenticated API boundaries and shared contracts.
- No provider SDK or direct LLM adapter use from the tool.
- No exact wording tests or brittle assertions about generated prose.
- No cost estimation.
- Preserve partial results and classify failures accurately.
- No new endpoint. If an existing endpoint contract changes, update its current stack-E2E file and
  API docs in the same EPIC.

## Deliverables

- Typed judge client and output validator.
- Semantic judge prompt/serialization with body-limit handling.
- Per-question result model and run-summary aggregation.
- Safe incremental JSON report writer and console renderer.
- Tests for paraphrase pass, missing element fail, contradiction fail, malformed output, judge/API
  errors, partial writes, pass-rate denominator, model mismatch, and unavailable cost.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: `ApiResponse`, raw exchange response, Message metadata,
   declared/effective model fields, judge result, question result, and run report.
2. Search for duplicated type definitions, repeated inline response shapes, local copies in
   console/client code, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse shared API types and the prompt 00 cleanup decisions.
5. If no canonical owner exists, create one rather than adding another local wire shape.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required
- `docs/ARCHITECTURE.md` if the evaluator/judge boundary needs documentation
- `docs/API_CONTRACT.md` if the consumed raw-exchange contract or limits changed
- `docs/DATA_MODEL.md` only if the report is mistakenly persisted as Core data; local report files
  should remain outside the Core data model
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` if evaluation coverage guidance changes
- `docs/TECH_STACK.md` if a runtime dependency was added
- `docs/EPICS.md` only if the delivered status/scope changed

If no further doc changes are needed, explicitly verify that the current docs remain accurate. Code,
tests, and docs move together.

## Acceptance Criteria

- [ ] Valid paraphrases can pass without exact wording.
- [ ] Missing essential elements and contradictions can fail with explanations.
- [ ] Judge output is machine-validated and malformed output is a `judge_error`.
- [ ] Avatar API errors, judge errors, and quality failures remain distinct.
- [ ] Reports contain per-question and run-level data with stable JSON shape.
- [ ] Partial reports remain valid after interruption or a non-fatal question failure.
- [ ] Pass rate and metric aggregates have explicit denominators and nullable-cost behavior.
- [ ] Console output is readable and does not leak secrets or unbounded prompts.
- [ ] Tests cover all required semantic and failure cases.
- [ ] Documentation accuracy is explicitly verified.
