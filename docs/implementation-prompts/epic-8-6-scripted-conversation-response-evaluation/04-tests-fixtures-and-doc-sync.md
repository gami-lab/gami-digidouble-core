# Harden the Evaluation Tool and Close Documentation

## Context

Prompts 00–03 provide the contract boundary, definition loader, sequential runner, judge, and
report writer. This final slice proves the complete tool without making network calls in the normal
unit suite, adds a usable seeded-scenario definition, documents invocation, and synchronizes every
impacted project document.

This EPIC introduces no new HTTP endpoint. The existing Core endpoints already have route and
stack-E2E ownership. Tool tests should mock the HTTP boundary; they must not turn the evaluation
suite into a provider benchmark or require live credentials on every run.

## Scope

In scope:

- add deterministic unit tests for definition validation, client request order, same-session reuse,
  Avatar selection, envelope/auth/not-found/timeout failures, judge validation, aggregation, and
  safe report persistence;
- add an integration-style tool test with a scripted `fetch` fake proving at least three ordered
  questions flow through one session and each question is judged after its Avatar response;
- cover semantic paraphrase pass, missing essential element fail, contradiction fail, additional
  relevant information, malformed judge output, judge API error, Avatar API error, partial report,
  model mismatch, missing cost, and cost completeness policy;
- add one real seeded-scenario JSON definition based on `murder-party-villa-miralac` using a stable
  initial-avatar selector such as `Clara Whitcombe`, while keeping it opt-in for live execution;
- document local setup, required environment variables, command examples, model configuration
  preconditions, output location, report semantics, and known cost limitations;
- run formatting, lint, typecheck, package tests, and the relevant workspace checks;
- update all impacted documentation and mark EPIC 8.6 complete only if the implementation truly
  satisfies the prompt-pack definition of done.

Out of scope:

- adding a UI, dashboard, CI workflow, load test, parallel execution, or historical result store;
- requiring real provider credentials in default tests;
- adding new Core routes or bypassing existing model-resolution rules;
- changing unrelated test baselines or cleaning pre-existing debt outside this EPIC.

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
- `apps/core/src/seed/murder-party/README.md`
- `apps/core/src/seed/murder-party/test-script.md`
- `apps/core/src/api/routes/exchange.stack-e2e.test.ts`
- all prompt files in `docs/implementation-prompts/epic-8-6-scripted-conversation-response-evaluation/`

## Implementation Guidance

- Keep all deterministic tests local to the evaluator package. Use a request-aware `fetch` fake that
  records path, method, headers, request body, and call order, then returns canonical envelopes.
- Prove the runner does not send question 2 before question 1's Avatar response and judge completion.
  Prove all successful message requests use the same conversation ID.
- Use stable seeded scenario identifiers only where the repository seed documents them. Resolve the
  initial Avatar by exact name if seed-created Avatar IDs are generated dynamically. Mark the real
  scenario execution as opt-in and require API credentials through environment variables.
- Do not assert exact generated prose in live-provider tests. If an opt-in smoke test is added,
  assert non-empty responses, valid report structure, bounded failures, and metadata presence.
- If the existing API contract is modified during implementation, extend the existing route test
  and corresponding `*.stack-e2e.test.ts` file in the same EPIC. Since this EPIC adds no endpoint,
  do not create a speculative evaluator stack-E2E route file.
- Update documentation from observed implementation, not from the original attachment's claims.
  In particular, state that model selection is server-configured and cost may be unavailable.

## Constraints

- Follow repository test-tier naming and keep unit/integration/stack-E2E responsibilities separate.
- Do not require network access, a database, Redis, Langfuse, or provider credentials for default tests.
- Do not test writing quality or exact model prose; test structure, semantics classification,
  ordering, contracts, error handling, and metrics mapping.
- Do not add a new API endpoint. Any existing endpoint contract change still requires its existing
  stack-E2E auth/validation/not-found coverage.
- Keep docs and implementation synchronized before declaring completion.

## Deliverables

- Complete deterministic test suite for the tool package.
- Three-question same-session integration-style fake-HTTP test.
- Opt-in `murder-party-villa-miralac` definition and usage documentation.
- Updated package/workspace scripts and quality-check instructions.
- Accurate updates to `docs/PROJECT_STATUS.md` and any impacted architecture, contract, data-model,
  testing, stack, ownership, and EPIC documents.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: evaluation definition, Scenario, Avatar, Session,
   Conversation, Message, raw exchange, judge result, report, and test-tier boundaries.
2. Search for duplicated type definitions, repeated inline response shapes, local copies in
   console/client code, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse shared API types and the earlier prompt decisions.
5. If no canonical owner exists, create one before adding another shape.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required; record only actually shipped behavior
- `docs/EPICS.md` — mark EPIC 8.6 complete only when all acceptance criteria are met
- `docs/ARCHITECTURE.md` — tool boundary/module map if impacted
- `docs/API_CONTRACT.md` — only for actual existing-route contract changes
- `docs/DATA_MODEL.md` — only for actual persisted Core data changes
- `docs/TECH_STACK.md` — workspace/runtime dependency changes
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` — new evaluator test guidance/coverage
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md` — if shared DTO ownership changed
- tool README/usage docs — command, configuration, output, and limitations

If any document does not need edits, explicitly verify that it remains accurate. Code, tests, and
docs move together; code without documentation sync is incomplete.

## Acceptance Criteria

- [ ] Default tests are deterministic and do not require live providers or infrastructure.
- [ ] Three or more questions are proven to execute in order through one session/conversation.
- [ ] Paraphrases, missing elements, contradictions, extra relevant detail, malformed judge output,
      API errors, judge errors, partial reports, model mismatch, and missing cost are covered.
- [ ] The seeded-scenario definition is readable, versioned, and opt-in executable.
- [ ] No test confuses an API/judge error with a quality failure.
- [ ] No report estimates unavailable cost.
- [ ] Existing route stack-E2E coverage is updated if and only if an existing route changed.
- [ ] Relevant workspace lint, typecheck, formatting, and tests pass.
- [ ] All impacted docs are accurate and `PROJECT_STATUS.md` is updated.
