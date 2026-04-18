# TEST_COVERAGE_PLAN.md

What to test in each module and what scenarios must be covered.
For rules on _how_ to design and write tests, see [TEST_STRATEGY.md](TEST_STRATEGY.md).

---

# Module Coverage Checklists

## API Layer

**Goals:** request validation, stable response envelopes, correct error codes, auth enforcement.

Must test:

- missing required fields → 400
- invalid IDs / malformed input → 400
- unauthorized access → 401
- session not found → 404
- successful happy paths return correct envelope
- contract shape of all public endpoints
- SSE event ordering (when SSE is used)

Avoid: retesting business rules already covered by unit tests.

---

## Conversation Module

**Goals:** session lifecycle correctness, message persistence, history retrieval, reset behavior.

Must test:

- session creation
- message persistence order
- message metadata persistence
- history retrieval consistency
- reset deletes the right data and keeps the right data

---

## Avatar Module

**Goals:** prompt assembly, persona config respected, wrapper integration reliable.

Must test:

- avatar input contract
- fallback handling on provider failure
- structured output parsing when required
- streaming assembly
- error propagation on provider failures

Do not test prose quality or writing style — only structure, contract, and error behavior.

---

## Game Master Module

**Goals:** GM is lightweight, predictable, triggers correctly, state transitions are valid.

Must test:

- init mode output
- background trigger output
- trigger conditions (positive and negative)
- state reducer logic
- duplicate topic handling
- progression update rules

This module deserves strong unit coverage — it controls orchestration semantics.

---

## Memory Module

**Goals:** memory stays useful, bounded, and relevant.

Must test:

- session summary creation/update
- persistent user fact extraction rules
- retrieval of relevant facts
- memory overwrite/update behavior
- long conversation compaction boundaries (30+ turns)
- reset behavior

Risk: memory systems silently degrade quality while appearing to work. Requires both logic tests and conversational regression checks.

---

## Context Module

**Goals:** right information selected, token budget respected, source traceability possible.

Must test:

- recent messages included/excluded correctly
- memory injected correctly
- scenario context injected correctly
- knowledge retrieval merged correctly
- GM directives injected correctly
- context trimming when over budget
- precedence rules when inputs conflict

This is one of the highest-risk modules in the project.

---

## Knowledge Module

**Goals:** ingestion works, chunking works, retrieval is usable, source metadata stays coherent.

Must test:

- source registration
- ingestion job status transitions
- chunk creation and embedding persistence
- retrieval by scenario/source
- filtering behavior
- invalid source handling

Retrieval quality is not only a technical issue — combine deterministic tests with real-content validation.

---

## Observability Module

**Goals:** important events are captured with all fields the consumer (Langfuse dashboard) needs.

Must test:

- request ID propagation
- latency measurement presence
- token/cost recording when available
- input/output content forwarded to generation traces
- GM trigger event logging
- failure event logging
- no raw sensitive data in logs

---

# Critical E2E Flows

Minimum set that must pass on every release:

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

# Conversation Regression Format

Each regression case must include:

- **setup:** scenario and persona config
- **input turns:** the message sequence
- **expected properties:** what the response must contain or do (not exact wording)
- **forbidden properties:** what must never appear
- **review notes:** why this case exists

Example expected properties: response stays in persona · references a prior known fact · uses a retrieved concept · does not repeat the previous answer.

---

# Fixture Sets Needed

### Scenarios

- basic conversation
- memory-heavy scenario
- knowledge-enabled scenario
- GM-enabled scenario

### Conversations

- short session (happy path)
- long session (30+ turns for memory testing)
- adversarial inputs (injection attempts, gibberish, very long messages)
- user fact emergence across turns

### Knowledge

- small valid markdown source
- source with overlapping topics
- corrupted / invalid source

### Provider responses

- normal response
- timeout
- malformed JSON response
- empty response
- partial stream failure

---

# Resilience: Failure Modes to Cover

| Failure                | What to verify                                    |
| ---------------------- | ------------------------------------------------- |
| Provider timeout       | Graceful error response, no hung sessions         |
| Partial stream failure | Clean error, no corrupted output                  |
| DB unavailable         | Proper error propagation, no data corruption      |
| Redis unavailable      | Fallback or clean error                           |
| Retry storm            | Backoff in place, upstream pressure not amplified |
| Duplicate GM event     | Idempotent handling                               |
| Queue delay            | Eventual consistency holds                        |
| Stale cache read       | TTL and invalidation working                      |

---

# Security Testing Scope

### Per PR (static)

- SAST scan on TypeScript source
- Dependency vulnerability scan (`pnpm-lock.yaml`)
- Secrets scan (no credentials committed)

### On main

- Container image scan for OS/package CVEs

### Nightly (dynamic)

- API auth abuse: missing/expired/malformed keys rejected; timing-safe comparison in use
- Rate limit verification
- Injection tests: user inputs cannot escape context (prompt injection, SQL injection)
- Session isolation: one API key cannot read or influence another session
- DAST scan against staging

Policy: no critical/high CVEs on main. Security findings are bugs, not tech debt.

---

# Performance Targets

### Per PR

Micro benchmarks on changed hot paths: token budget logic, context assembly, GM trigger evaluation.

### On main

k6 smoke; fail if p95 regresses beyond threshold.

### Nightly

Soak, spike, concurrency, RSS leak check, DB query regression vs baseline.

| Metric                          | Target             |
| ------------------------------- | ------------------ |
| p50 response latency            | TBD after baseline |
| p95 response latency            | TBD after baseline |
| Throughput (req/s)              | TBD after baseline |
| Time-to-first-token (streaming) | TBD after baseline |
| DB query count per request      | TBD after baseline |
| Memory (RSS) under soak         | TBD after baseline |

Do not invent hard numbers before measurement.

---

# Mutation Testing Targets

Run nightly on Stryker (or equivalent). Priority modules:

- Game Master trigger logic and state transitions
- Memory rules (fact extraction, summarization decisions)
- Token budget logic
- Input validation rules

Mutation score tracked as a trend metric — not a hard gate until a baseline exists.

---

# Engineering Quality Metrics to Track

| Metric                  | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| Flaky test count        | Detect unreliable tests before they erode trust |
| Suite runtime (PR gate) | Prevent gate creep that leads to bypassing      |
| Escaped defects         | Bugs found in production with no covering test  |
| Mutation score          | Confidence in assertion quality                 |
| p95 latency trend       | Early warning for performance regression        |
| Provider failure rate   | LLM availability signal                         |
| Token cost per session  | Cost regression detection                       |

---

# Release Validation Checklist

Before a release or major demo:

- [ ] Core API flows pass
- [ ] Stream flow works end-to-end
- [ ] Memory works across multiple turns
- [ ] Reset works cleanly
- [ ] Scenario config loads correctly
- [ ] Knowledge ingestion works on test content
- [ ] Logs and metrics visible in Langfuse
- [ ] Fallback behavior acceptable under provider failure
- [ ] No major token/cost explosion
- [ ] Representative demo scenarios still feel coherent
