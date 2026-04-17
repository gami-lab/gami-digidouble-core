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

Protect stable interfaces.

## Must cover

- public API request/response schemas
- stream event schema
- Game Master input/output
- scenario config schema
- repository interface expectations
- wrapper input/output format

## Recommendation

Use schema validation and type-driven checks where practical.

Important for this project because most modules communicate through explicit contracts.

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

## Needed fixture sets

### 1. Scenario fixtures

Small valid scenarios for:

- basic conversation
- memory-heavy scenario
- knowledge-enabled scenario
- GM-enabled scenario

### 2. Conversation fixtures

- short session
- long session
- repetitive user
- user fact emergence
- stalled progression case

### 3. Knowledge fixtures

- small markdown file
- small PDF/text equivalent fixture
- invalid source fixture
- source with overlapping topics

### 4. Provider fixtures

- normal response
- timeout
- malformed JSON
- empty response
- provider error

---

# CI Strategy

## On every PR

Run:

- lint
- typecheck
- unit tests
- fast integration tests
- contract tests

These must stay fast and reliable.

## On main branch

Run:

- all of the above
- extended integration suite
- E2E suite with fake provider

## Nightly / manual

Run:

- benchmark suite
- selected real-provider smoke tests
- conversation regression pack
- latency/cost comparison jobs

---

# Non-Functional Thresholds

These are initial guardrails, not permanent truths.

## Initial thresholds to track

- unit + fast integration suite should remain fast enough for daily use
- critical endpoints must have bounded latency in local/dev conditions
- streaming must start quickly enough to feel responsive
- token use per turn must remain within expected budget
- fallback/error rate should stay low
- GM trigger rate should remain understandable, not chaotic

Exact numeric thresholds can be added once the first baseline exists.

Do not invent hard numbers before measurement.

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

# Initial Recommended Test Stack

The exact libraries may evolve, but the strategy assumes:

- test runner for TypeScript unit/integration tests
- API test tooling
- schema/assertion helpers
- Docker-based local integration environment
- optional browser/E2E runner for back-office later
- provider fakes for deterministic CI
- lightweight evaluation scripts for manual/nightly comparison

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
