# TEST_STRATEGY.md

## Purpose

Define how we test the MVP Core so that development stays fast, safe, and measurable.

This document is not about maximizing test volume.

It is about testing the parts that matter most for this project:

- core business logic
- API contract stability
- orchestration correctness
- memory and context behavior
- reliability of AI integrations
- regression detection on real conversation flows

The system is AI-powered, so classic testing alone is not enough.

We need a strategy that combines:

- deterministic tests where possible
- bounded integration tests
- conversation regression tests
- observability-driven validation
- lightweight evaluation loops

---

# Testing Principles

## 1. Test the risk, not the code volume

Not all code deserves the same testing effort.

We prioritize testing where failure is costly, confusing, or hard to detect manually.

Highest priority areas:

- session lifecycle
- context assembly
- Game Master decisions
- memory update logic
- API contracts
- fallback behavior
- provider wrapper behavior

Lower priority areas:

- thin pass-through mapping
- obvious DTO plumbing
- trivial wrappers with no logic

---

## 2. Prefer deterministic tests first

When logic can be tested without an LLM, it should be.

Examples:

- reducers
- trigger decisions
- validation rules
- context selection
- token budget rules
- repository behavior
- API error cases

LLM calls are expensive, slower, and less stable.

Use them only where they validate something real.

---

## 3. Separate product logic from provider behavior

We do not test OpenAI, Anthropic, or Mistral.

We test:

- our wrapper
- our retry logic
- our timeout logic
- our fallback logic
- our schema enforcement
- our orchestration behavior around providers

Provider quality comparisons belong to benchmarks and evaluations, not normal CI.

---

## 4. Test contracts aggressively

This system is API-first and modular.

That means contract breakage is one of the biggest risks.

We must protect:

- HTTP request/response shapes
- streaming event shapes
- internal module boundaries where useful
- Game Master input/output contracts
- scenario config schema
- repository expectations

If contracts drift silently, development slows down quickly.

---

## 5. Use observability as part of testing

Some failures are only visible through metrics:

- latency explosion
- token explosion
- repeated fallback use
- memory compaction too frequent
- retrieval overuse
- GM triggering too often

Testing is not only assertions in code.

Testing also includes checking whether the system behaves within acceptable bounds.

---

## 6. Keep the test suite useful

A test suite that is slow, fragile, or unreadable becomes dead weight.

We prefer:

- fewer useful tests
- clear naming
- simple fixtures
- explicit setup
- small focused assertions

We avoid:

- giant opaque fixtures
- snapshot abuse
- overly clever test helpers
- brittle end-to-end scenarios everywhere

---

# Test Pyramid for This Project

We do not use a generic pyramid mechanically.

We adapt it to this architecture.

## Level 1 — Unit Tests

Fast, deterministic, isolated.

Test the core logic of modules without infrastructure.

Examples:

- Game Master trigger logic
- state reducers
- memory compaction rules
- context builder selection rules
- token budget trimming
- scenario validation
- utility logic
- mapper logic with actual value

These should be the largest part of the suite.

---

## Level 2 — Integration Tests

Test interaction between real modules and adapters.

Examples:

- API endpoint → use case → repository
- repository ↔ PostgreSQL
- knowledge ingestion pipeline with test data
- wrapper ↔ provider mock
- event logging pipeline
- Redis-backed flows if Redis is actually used

These validate that modules work together correctly.

---

## Level 3 — End-to-End Tests

Test a real user flow through the running application.

Examples:

- start session → send message → read history
- start session with scenario → message with streaming
- register source → ingest → retrieval used in conversation
- reset session

These should be fewer and focused on critical paths.

---

## Level 4 — Evaluation / Regression Tests for AI Behavior

This is specific to AI systems.

We need controlled conversation-based validation for:

- coherence
- persona consistency
- memory continuity
- retrieval relevance
- orchestration behavior
- response structure when JSON is required

These are not always strict deterministic pass/fail tests.

Some are scored, reviewed, or threshold-based.

---

# What We Test by Module

## 1. API Layer

### Test goals

- request validation works
- response envelopes are stable
- error codes are correct
- streaming shape is stable
- auth behavior is correct

### Must test

- missing required fields
- invalid IDs / malformed input
- unauthorized access
- session not found
- scenario not found
- successful happy paths
- contract shape of all public endpoints
- SSE event ordering if SSE is used

### Avoid

- retesting business rules already covered in unit tests through too many API tests

---

## 2. Conversation Module

### Test goals

- session lifecycle is correct
- messages are stored correctly
- history retrieval is correct
- reset behavior is correct

### Must test

- session creation
- message persistence order
- archived / closed behavior once defined
- message metadata persistence
- history retrieval consistency
- reset deletes the right data and keeps the right data

---

## 3. Avatar Module

### Test goals

- prompt/input assembly is correct
- role and persona configuration is respected
- wrapper integration is reliable

### Must test

- avatar input contract
- fallback handling
- structured output parsing when required
- streaming assembly
- error handling on provider failures

### Important note

We do not try to unit test “good writing quality”.

We test:

- structure
- continuity hooks
- error handling
- provider integration behavior

---

## 4. Game Master Module

### Test goals

- GM remains lightweight and predictable
- trigger decisions behave as intended
- state updates are valid
- background intervention logic does not drift

### Must test

- init mode output
- background trigger output
- trigger conditions
- no-trigger conditions
- state reducer logic
- duplicate topic handling
- progression update rules
- avatar switch logic if supported

This module deserves strong unit coverage because it controls orchestration semantics.

---

## 5. Memory Module

### Test goals

- memory stays useful, bounded, and relevant

### Must test

- session summary creation/update
- persistent user fact extraction rules
- retrieval of relevant facts
- memory overwrite/update behavior
- long conversation compaction boundaries
- reset behavior

### Risk to watch

Memory systems silently degrade quality while appearing to “work”.

This needs both logic tests and conversational regression checks.

---

## 6. Context Module

### Test goals

- the right information is selected
- irrelevant information is excluded
- token budget is respected
- source traceability is possible

### Must test

- recent messages included/excluded correctly
- memory included correctly
- scenario context injected correctly
- knowledge retrieval merged correctly
- GM directives injected correctly
- context trimming rules
- precedence rules when inputs conflict

This is one of the highest-risk modules in the project.

---

## 7. Knowledge Module

### Test goals

- ingestion works
- chunking works
- retrieval is usable
- source metadata stays coherent

### Must test

- source registration
- ingestion job status changes
- chunk creation
- embedding persistence
- retrieval by scenario/source
- filtering behavior
- invalid source handling

### Special caution

Retrieval quality is not only a technical issue.

Need both deterministic tests and real-content validation.

---

## 8. Observability Module

### Test goals

- important events are captured
- metrics are reliable enough to support decisions

### Must test

- request ID propagation
- latency measurement presence
- token/cost recording when available
- GM trigger event logging
- failure event logging
- no raw sensitive data leaks in logs if policy forbids it

---

# Test Types in Detail

# 1. Unit Tests

## Scope

Pure business logic and small module-level logic.

## Rules

- no network
- no real provider calls
- no real DB unless the repository itself is under test
- clear arrange / act / assert
- table-driven tests when logic branches are simple

## Examples

- `should_increment_interaction_count_on_every_gm_update`
- `should_not_add_duplicate_topic_when_topic_already_present`
- `should_trim_context_when_token_budget_exceeded`
- `should_reject_empty_message_content`

---

# 2. Integration Tests

## Scope

Real collaboration between components.

## Rules

- use real PostgreSQL when testing repositories
- use real Redis only if the feature depends on Redis semantics
- use mocked or fake LLM providers unless specifically validating provider integration
- avoid giant flows

## Examples

- `POST /v1/conversations/start creates session and returns summary`
- `session history returns persisted messages in chronological order`
- `knowledge ingestion stores chunks linked to source`
- `memory update writes session summary after message flow`

---

# 3. End-to-End Tests

## Scope

Critical system workflows on a running stack.

## Rules

- keep them few
- cover real user journeys
- avoid depending on non-deterministic model output where possible
- prefer stubbed/fake provider for CI stability
- optionally run a second non-blocking suite against a real provider in manual or nightly environments

## Critical MVP E2E flows

1. start session
2. send message
3. stream response
4. read history
5. reset session
6. create scenario
7. register source
8. ingest source
9. ask question that uses retrieved knowledge

---

# 4. Contract Tests

## Purpose

Protect stable interfaces. Contracts are a scaling tool — they let modules evolve independently without silent breakage.

## Public API contracts

HTTP schema stability for all consumer-facing endpoints:

- request/response schemas for every route
- stream event envelope
- error response shape (`ApiResponse<T>`)
- pagination and filter parameters

## Internal contracts

Explicit shape guarantees between modules:

- Game Master input/output schema
- Avatar prompt assembly output
- Context Manager assembled payload
- scenario config schema
- repository interface expectations
- LLM adapter input/output format

## Consumer-driven contracts

If frontends or external integrators depend on the API, capture their expectations as explicit schema tests. Do not let internal changes silently break consumers.

## Versioning rules

- additive changes (new optional fields) are safe without a version bump
- breaking changes (removed fields, type changes, renamed paths) require a version bump and update to `API_CONTRACT.md`
- any breaking API change must be reviewed before merge

## Recommendation

Use schema validation and type-driven checks where practical. Keep contract tests close to the boundary they protect.

---

# 5. Conversation Regression Tests

## Purpose

Protect behavior that users actually experience.

These are curated conversation scenarios used to detect regressions.

## Focus areas

- avatar continuity
- memory recall
- retrieval usage
- Game Master influence
- scenario progression
- tone/persona stability
- bounded latency and token use

## Format

Each regression case should include:

- scenario/setup
- input turns
- expected properties
- optional forbidden properties
- review notes

## Example expected properties

- response stays in persona
- response references prior known fact
- response uses retrieved concept
- response does not repeat previous answer
- response stays within reasonable length

Important: most of these should validate properties, not exact wording.

---

# 6. Benchmark / Evaluation Tests

## Purpose

Support product and architecture decisions.

These are not part of normal fast CI.

They are run manually, nightly, or before important decisions.

## Examples

- provider A vs provider B for GM structured reliability
- latency comparison avatar-only vs avatar+GM
- retrieval quality with different chunk sizes
- cost comparison across models
- memory quality after 30 turns

## Outputs

- metrics report
- comparison table
- recommendation

## AI Eval harness (roadmap)

Do not build now, but plan for it. Eventually track:

- scenario scorecards (structured rubric per scenario type)
- persona consistency score (does the avatar remain in character?)
- factual grounding score (are claims supported by retrieved knowledge?)
- retrieval usefulness score (is what was retrieved actually used?)
- cost per successful session

Do not add an evaluation platform before MVP needs it. The conversation regression tests and benchmark suite are sufficient for Phase A. The eval harness belongs to Phase B/C.

---

# LLM Testing Strategy

## 1. Default approach

Use fakes or deterministic mocks in CI.

Why:

- faster
- cheaper
- more stable
- easier to debug

## 2. Real provider tests

Run only for:

- wrapper smoke tests
- manual validation
- nightly benchmark runs
- pre-release checks on critical flows
- `POST /v1/exchange` live smoke with real `OPENAI_API_KEY` when credentials are available

## 3. What to assert with real LLMs

Prefer:

- schema validity
- field presence
- bounded latency
- no provider crash
- expected class of behavior

Avoid:

- exact sentence matching
- overly brittle phrasing assertions

---

# Fixtures and Test Data

## Principles

- small
- explicit
- scenario-based
- reusable without becoming magical
- versioned alongside test code — fixture changes are reviewed like code changes

## Data governance

- never use real user data in fixtures without anonymization
- adversarial and edge-case fixtures are as important as happy-path ones
- multilingual samples should be included once the system supports them
- long conversation fixtures (30+ turns) are required for memory regression coverage
- fixtures for corrupted or malformed inputs must exist for every ingestion path

## Needed fixture sets

### 1. Scenario fixtures

Small valid scenarios for:

- basic conversation
- memory-heavy scenario
- knowledge-enabled scenario
- GM-enabled scenario

### 2. Conversation fixtures

- short session
- long session (30+ turns for memory testing)
- repetitive user
- user fact emergence
- stalled progression case
- adversarial user inputs (injection attempts, gibberish, very long messages)
- multilingual inputs (when applicable)

### 3. Knowledge fixtures

- small markdown file
- small PDF/text equivalent fixture
- invalid source fixture
- source with overlapping topics
- corrupted document fixture

### 4. Provider fixtures

- normal response
- timeout
- malformed JSON
- empty response
- provider error
- partial stream failure

---

# CI Enforcement Levels

## Pull Requests (blocking — must pass to merge)

- lint
- typecheck
- unit tests
- fast integration tests
- contract validation
- SAST scan
- secrets scan
- dependency vulnerability check

These must stay fast and reliable. A slow PR gate is a gate that gets bypassed.

## Main branch (blocking — must pass to deploy)

- all PR checks
- extended integration suite
- E2E critical flows (real providers skip cleanly via `describe.skipIf` when keys are absent)
- container image scan
- performance smoke thresholds (latency budget check)

## Nightly (non-blocking — alerts on failure)

- mutation test suite (Game Master, memory, token budget, validation logic)
- real-provider smoke tests
- conversation regression pack
- DAST against staging
- soak and spike performance suite
- latency/cost comparison jobs

## Release (full gate)

- all of the above
- production smoke test
- release validation checklist (see below)

---

| Trigger | Checks                                                                 |
| ------- | ---------------------------------------------------------------------- |
| PR      | lint, typecheck, unit, fast integration, contracts, SAST, secrets scan |
| Main    | full integration, E2E, image scan, perf smoke                          |
| Nightly | mutation, DAST, regression packs, soak/perf                            |
| Release | full gate + production smoke                                           |

---

# File Naming Convention and CI Gate Assignment

Every test file must follow this naming scheme. The suffix determines **which CI gate owns it** and which Vitest config picks it up.

| File suffix             | Test tier   | Vitest config                  | CI gate                        |
| ----------------------- | ----------- | ------------------------------ | ------------------------------ |
| `*.test.ts`             | Unit        | `vitest.config.ts`             | PR fast gate (always runs)     |
| `*.integration.test.ts` | Integration | `vitest.integration.config.ts` | Extended (main push) + nightly |
| `*.e2e.test.ts`         | E2E         | `vitest.integration.config.ts` | Extended (main push) + nightly |

## Rules

- **Unit** (`*.test.ts`): no network, no real provider calls, no real DB. Always fast,
  always deterministic. These are the hard gate — a failed unit test blocks the PR.

- **Integration** (`*.integration.test.ts`): real adapter collaboration. Tests that require
  live credentials must guard their entire `describe` block with `describe.skipIf(!apiKey)`.
  They run in the extended CI gate without credentials (skipped gracefully) and in the
  nightly job with real credentials.

- **E2E** (`*.e2e.test.ts`): full HTTP-stack flows through a running Fastify server. Same
  `describe.skipIf` guard convention as integration tests for provider-dependent suites.
  E2E tests that use the `null` LLM provider always execute; those exercising real providers
  are skipped unless the corresponding key is present.

## Scripts

```
pnpm test                        # unit tests only (fast gate)
pnpm test:integration-e2e        # integration + E2E (extended gate / nightly)
pnpm turbo run test:coverage --filter=@gami/core   # unit tests with coverage
```

## Do not mix tiers in one file

A file named `*.test.ts` must not make network calls or call real LLM providers.
A file named `*.integration.test.ts` must not assert on prompt wording or prose quality.
If a test doesn't fit cleanly, create the right file.

---

# Security Testing

Security is not a QA phase — it is part of each PR and release gate.

## Static security (every PR)

- **SAST**: static analysis scan on TypeScript source
- **Dependency vulnerability scan**: check for known CVEs in `pnpm-lock.yaml` dependencies
- **Secrets scan**: no credentials, tokens, or keys committed to the repository
- **Container image scan** (on main): scan built Docker image for OS and package vulnerabilities

## Dynamic security (staging / nightly)

- **API auth abuse tests**: verify that requests with missing, expired, or malformed API keys are rejected; timing-safe comparison must be in use
- **Rate limit verification**: verify that rate limiting is applied and cannot be trivially bypassed
- **Injection tests**: validate that user-supplied inputs (message, scenario fields) cannot escape their context (prompt injection, SQL injection)
- **Broken access control checks**: ensure session isolation — one API key cannot read or influence another session
- **DAST**: automated dynamic scan against staging environment nightly

## Policy

- no critical or high-severity vulnerabilities may land on `main`
- no secrets may ever be committed — enforce with pre-commit and CI gates
- security findings are treated as bugs, not tech debt

---

# Performance Strategy

## Per PR

- micro benchmarks on hot paths if changed (token budget logic, context assembly, GM trigger evaluation)

## On main branch

- k6 smoke test on critical API endpoints
- latency budget check: fail if p95 regresses beyond threshold

## Nightly

- soak test: sustained load for a meaningful duration
- spike test: sudden concurrency burst
- concurrency scenarios: multiple simultaneous sessions
- memory leak check: monitor RSS over time under load
- DB query regression: compare query count per request vs baseline

## Metrics to track

See the Non-Functional Thresholds section for the target table. Once a baseline is measured, thresholds become enforced gates.

---

# Mutation Testing

High coverage alone does not mean confident tests. Mutation testing detects weak assertions — tests that pass even when logic is broken.

## Run nightly on high-value modules

- Game Master trigger logic and state transitions
- Memory rules (fact extraction, summarization decisions)
- Token budget logic (context assembly limits)
- Input validation rules
- Routing and branching decisions in use cases

## Goal

- detect "green tests, broken logic" scenarios
- prevent coverage inflation hiding poor assertions
- mutation score is tracked as a trend metric, not a hard gate (until baseline exists)

## Tooling

Evaluate Stryker or equivalent TypeScript mutation runner. Start with the Game Master module as the highest-value target.

---

# Resilience and Chaos Testing

The system is async and integrates external providers. It must degrade gracefully, not silently corrupt state or hang.

## Test the following failure modes

- **Provider timeout**: LLM call times out — verify graceful error response, no hung sessions
- **Partial stream failure**: stream starts then drops mid-response
- **DB unavailable**: repository calls fail — verify proper error propagation, no data corruption
- **Redis unavailable**: cache layer fails — verify fallback or clean error
- **Retry storm**: verify retry logic has backoff and does not amplify upstream pressure
- **Duplicate events**: same GM event delivered twice — verify idempotency
- **Queue delay**: GM trigger delayed significantly — verify eventual consistency holds
- **Stale memory read**: outdated context returns from cache — verify TTL and invalidation

## Aligned with principle

This directly supports the "Build for Real Use, Not Demo" principle. The system should be honest about failures rather than silently degrading.

---

# Non-Functional Thresholds

These are initial guardrails, not permanent truths.

## Code coverage thresholds (enforced)

Enforced via `@vitest/coverage-v8` in `vitest.config.ts`. Build fails if any threshold is not met:

| Metric     | Threshold |
| ---------- | --------- |
| Statements | ≥ 80%     |
| Branches   | ≥ 80%     |
| Functions  | ≥ 80%     |
| Lines      | ≥ 80%     |

**Current baseline (post-EPIC 1.2):** 94.4% statements · 87.9% branches · 100% functions · 67 tests · 15 files

Excluded from coverage: type-only files (`*.types.ts`), port interfaces (`application/ports/**`), infrastructure stubs (`cache/`, `db/`), entry point (`index.ts`).

## Performance thresholds to track

Metrics to capture once baseline exists:

| Metric                          | Target (TBD after measurement) |
| ------------------------------- | ------------------------------ |
| p50 response latency            | to be established              |
| p95 response latency            | to be established              |
| p99 response latency            | to be established              |
| Throughput (req/s)              | to be established              |
| Time-to-first-token (streaming) | to be established              |
| Tokens per turn (avatar path)   | to be established              |
| DB query count per request      | to be established              |
| Memory (RSS) under soak         | to be established              |

Do not invent hard numbers before measurement. Once the first baseline exists, codify it here and enforce it in CI performance smoke tests.

## Other operational thresholds

- unit + fast integration suite must remain fast enough for daily use
- fallback/error rate should stay low
- GM trigger rate should remain understandable, not chaotic
- provider failure rate should be monitored and alerted on

---

# Release Validation Checklist

Before a release or major demo, validate:

- core API flows pass
- stream flow works
- memory works across multiple turns
- reset works
- scenario config loads correctly
- knowledge ingestion works on test content
- logs/metrics are visible
- fallback behavior is acceptable
- no major token/cost explosion
- representative demo scenarios still feel coherent

---

# Test Ownership

Testing is not owned by QA alone.

## Developers own

- unit tests
- integration tests
- contract tests
- keeping regression risk low when changing modules

## Product / design / operators may help validate

- conversation quality
- scenario coherence
- persona quality
- practical usefulness

## Everyone owns

- reporting regressions clearly
- adding regression cases when bugs escape
- keeping the suite readable

---

---

# Engineering Quality Dashboard

Since observability is a first-class concern, test quality should also be visible as a trend — not just a pass/fail gate.

## Track the following metrics over time

| Metric                  | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| Flaky test count        | Detect unreliable tests before they erode trust    |
| Suite runtime (PR gate) | Prevent gate creep that leads to bypassing         |
| Deploy success rate     | Signal stability of the release pipeline           |
| Escaped defects         | Bugs found in production that had no covering test |
| Mutation score          | Confidence in assertion quality                    |
| p95 latency trend       | Early warning for performance regression           |
| Provider failure rate   | LLM availability signal                            |
| Token cost per session  | Cost regression detection                          |

This turns the test suite into a management signal, not just a binary green/red check.

---

# When a Bug Is Found

Default rule:

1. reproduce it
2. add the smallest meaningful test that would catch it again
3. fix it
4. verify no broader regression was introduced

Do not only patch behavior.
Capture the learning in the test suite where it adds value.

---

# What We Intentionally Avoid

For now, we avoid:

- testing every private helper
- giant brittle snapshots of full AI outputs
- expensive real-provider tests on every PR
- over-mocking all architecture boundaries
- massive E2E suites as a substitute for module tests
- pretending AI behavior is fully deterministic
- adding a dedicated evaluation platform before MVP needs it

---

# Implemented Test Stack

## Core tooling (active)

| Tool                    | Version | Purpose                                               |
| ----------------------- | ------- | ----------------------------------------------------- |
| **Vitest**              | 3.2.4   | Test runner for unit, API, integration, and E2E tests |
| **@vitest/coverage-v8** | 3.2.4   | Code coverage via V8 native instrumentation           |
| **Fastify `inject()`**  | —       | In-process HTTP request simulation for API tests      |

## Coverage configuration

Coverage is enforced in `apps/core/vitest.config.ts`:

```ts
coverage: {
  provider: 'v8',
  include: ['src/**/*.ts'],
  exclude: [
    'src/**/*.test.ts',
    'src/**/*.integration.test.ts',
    'src/**/*.e2e.test.ts',
    'src/index.ts',
    'src/**/*.types.ts',
    'src/application/ports/**',
    'src/infrastructure/cache/**',
    'src/infrastructure/db/**',
  ],
  thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
  reporter: ['text', 'lcov'],
}
```

Run coverage locally: `pnpm --filter @gami/core test:coverage`

## File naming conventions

| Pattern                 | Type                                           |
| ----------------------- | ---------------------------------------------- |
| `*.test.ts`             | Unit and API tests (no I/O, no real providers) |
| `*.integration.test.ts` | Live provider tests (real API calls, gated)    |
| `*.e2e.test.ts`         | Full HTTP stack tests (real providers, gated)  |

## Mock strategy

**Rule: mocks only at infrastructure adapter boundaries.**

- Domain and application layer tests: use `vi.fn()` references declared at module level (avoids `@typescript-eslint/unbound-method` lint errors)
- API route tests: inject `NullLlmAdapter` and `NullObservabilityAdapter` via the `ServerAdapters` interface — no mocking of internals
- Never mock domain logic, use case classes, or repository interfaces in API tests — only swap the infrastructure adapters

## E2E and integration test gating

Real-provider tests use `describe.skipIf` to skip cleanly in CI without credentials:

```ts
const apiKey = process.env['OPENAI_API_KEY']
describe.skipIf(!apiKey)('E2E — POST /v1/exchange with real OpenAI', () => {
  it('returns a non-empty reply', async () => { ... }, 30_000)
})
```

This enables:

- Clean CI runs (tests skipped, not failed, when keys are missing)
- Full local validation with `.env` loaded
- Nightly/manual real-provider runs with credentials injected

Keep the tooling boring and maintainable.

---

# Suggested Initial Test Suite Structure

```text
tests/
  unit/
    conversation/
    avatar/
    game-master/
    memory/
    context/
    scenario/
    shared/

  integration/
    api/
    repositories/
    knowledge/
    observability/

  e2e/
    conversation-flows/
    scenario-flows/
    knowledge-flows/

  regression/
    conversations/
    memory/
    retrieval/
    orchestration/

  fixtures/
    scenarios/
    conversations/
    knowledge/
    providers/
```
