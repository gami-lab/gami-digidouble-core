# TEST_STRATEGY.md

How we build and design tests for this project.
Application-specific coverage targets (what to test per module) are in [TEST_COVERAGE_PLAN.md](TEST_COVERAGE_PLAN.md).

---

# Principles

## 1. Test the risk, not the code volume

Prioritize where failure is costly or hard to detect. High-risk areas: session lifecycle, conversation lifecycle and history isolation, context assembly, Game Master decisions, memory logic, API contracts, provider wrappers. Low-risk: thin pass-through mappings, obvious DTO plumbing.

## 2. Prefer deterministic tests first

When logic can be tested without an LLM, it must be. LLM calls are slower, costlier, and less stable. Use real providers only where they validate something that cannot be faked.

## 3. Separate product logic from provider behavior

We do not test OpenAI, Anthropic, or Mistral. We test our wrapper, our retry/timeout/fallback logic, our schema enforcement, and our orchestration around providers. Provider quality comparisons belong to benchmarks, not CI.

## 4. Test contracts aggressively

Contract breakage is one of the biggest risks in a modular API-first system. Protect: HTTP request/response shapes, streaming event shapes, Game Master I/O contracts, scenario config schema, repository interfaces. Any breaking change requires a version bump and an update to [API_CONTRACT.md](API_CONTRACT.md).

Evaluation tooling follows the same contract-first rule as other API clients: shared response types
are reused, untrusted API values are normalized at the tool boundary, and unavailable cost is
asserted as `null` rather than zero. Tool unit tests remain deterministic and do not call
providers or Core internals. The evaluator's integration-style test uses one scripted `fetch` fake
to prove the composed HTTP ordering, same-session reuse, and judge-before-next-question invariant;
it is still local and credential-free, not a provider benchmark. The real seeded scenario remains
opt-in and is never part of the default suite.

## 4b. Prefer deterministic policy tests for orchestration

When behavior is defined by transition rules, pacing rules, constraints, and scenario goals, test it as deterministic policy first. LLM reasoning should be layered on top, not used as the only test surface.

Minimum assertions for orchestration updates:

- active avatar routing stays consistent across turns
- transition reasons are emitted when handoffs occur
- policy rule changes produce expected behavior deltas
- progression-driven routing does not regress into random switching

## 4c. Streaming message contracts

Streaming tests must protect both transport behavior and persistence boundaries. Cover ordered
public delta delivery, stale or out-of-order client deltas, one terminal completion, provider and
client interruption, provider-iterator/reader cleanup, no partial avatar persistence, and exactly
one completed avatar persistence. Also validate malformed public frames at the client boundary and
assert interruption outcome metadata at the observability boundary. Keep the legacy JSON
send-message route covered separately as an `ApiResponse<SendMessageResponse>` contract so the
additive stream cannot change it accidentally.

## 4d. Voice input contracts

Voice contract tests remain deterministic and provider-free. Cover bounded byte, duration, media,
language, conversation-ID, and utterance-ID validation; normalized final transcripts; blank,
interim, malformed, and over-limit transcription results; finite timeout/provider/cancellation
mapping; and cancellation before adapter work starts. Idempotency tests must cover one claim,
in-flight duplicates, completed replays, expired reservations, conflicting fingerprints, and safe
release before downstream turn execution. Voice tests must not import a provider SDK, persist raw
audio, or alter the canonical `Message`/`SendMessageRequest`/`MessageStreamEvent` contracts.

The Deepgram adapter is tested separately with an injected transport fake. These tests assert exact
provider request metadata, final-response validation, provider duration limits, HTTP failure
categories, timeout and cancellation propagation, and that credentials, audio, transcripts, and
provider payloads are absent from observability. Live provider smoke tests remain optional and are
not required for the normal credential-free suite.

Voice-turn coordinator tests additionally use fake application ports to verify active-conversation
validation, one transcript handoff to each existing turn flow, concurrent duplicate reservation
handling, pre- and post-transcription cancellation, provider failure propagation, downstream stream
interruption, bounded latency/outcome diagnostics, and absence of duplicate background work.

The voice HTTP route suite additionally covers raw-body parsing and byte/media/header limits,
authentication before parsing, canonical synchronous and SSE response shapes, standard error
mapping, unknown-conversation ordering, duplicate utterance rejection, and request-disconnect
cleanup. The stack-E2E suite uses real HTTP requests for both routes and covers auth, validation,
not-found, and environment-gated provider-backed success cases using a deterministic audio fixture.
Voice stack success checks are gated by `VOICE_STACK_E2E=1` and `VOICE_STACK_E2E_AUDIO_PATH`.
The Deepgram live smoke test is environment-gated by `DEEPGRAM_LIVE_SMOKE=1`, `DEEPGRAM_API_KEY`, and
`DEEPGRAM_LIVE_AUDIO_PATH`; skipped checks are reported as an environment limitation.

## 5. Assert from the consumer inward, not from the implementation outward

The most dangerous test gap is a test that passes because it only checks what the code already does, not what the consumer requires.

**Wrong (implementation-mirroring):** Write production code, then assert on the fields it already sets. Green by construction — any field the implementation forgot is untested.

**Required (consumer-contract):** Before writing production code, ask _"what must the consumer observe for this to actually work?"_ For an observability adapter, the consumer is the Langfuse dashboard — assert `input`, `output`, `usage`, `metadata`. For a use case trace call, assert the actual message content and reply, not only token counts.

**Rule:** When asserting on an object passed to any boundary (SDK, adapter, queue, external API), enumerate what the downstream consumer needs and assert every field explicitly. High coverage does not substitute for this.

## 6. Keep the suite useful

Fewer focused tests beat many brittle ones. Prefer: clear naming, simple fixtures, explicit arrange/act/assert. Avoid: giant opaque fixtures, snapshot abuse, overly clever helpers, giant E2E suites standing in for unit tests.

When structured configuration drives behavior, add regression tests around config changes to prevent silent orchestration drift.

---

## 7. Test the Admin plane as a contract, not an internal detail

Admin endpoints have consumers: operators, back-office UIs, monitoring systems.

Treat them with the same contract discipline as the public API.

Required tests:

- **Health aggregation:** verify that each dependency state (`ok` / `degraded` / `error`) produces the correct top-level status
- **Dependency probe:** verify that a simulated postgres timeout returns `status: 'degraded'`, not `status: 'ok'`
- **Session inspector:** verify the shape of returned state — messages, memory, GM state, events — not just that it doesn't crash
- **Turn-completed observability:** verify `turn_completed` payload keeps non-sensitive context-selection metadata (counts/flags only) without prompt content leakage
- **Context trace observability:** verify admin session-context responses include bounded `contextTrace` (policy, selected inputs, kept/trimmed summaries) and do not leak prompt/provider-sensitive fields
- **Memory inspector:** verify compact and layered admin memory routes (`/memory` and `/memory-layers`) keep stable envelope/shape and bounded short-term behavior
- **Inspector surface discipline:** verify only the canonical inspector route set is used (no compatibility aliases), and ensure console navigation keeps one inspector path
- **Reset:** verify that reset deletes messages and memory but keeps the session record; verify the audit log entry is created
- **Replay:** verify that replayed turn does NOT write a new message to the DB
- **Ingestion retry:** verify that retrying a completed job returns current status rather than creating a duplicate run
- **Embedding port contract:** verify ordered batch vectors, effective profile metadata, copy-safe
  vectors, deterministic test-fake output, and typed invalid-input failures without provider calls
- **OpenAI embedding adapter:** use a fake SDK client to verify safe batching, index reassembly,
  finite/count/model/dimension validation, retry-aware provider failures, and redacted bounded
  observability; keep live embedding checks opt-in behind `OPENAI_API_KEY`
- **Profile-aware ingestion:** verify one active-corpus snapshot per run, exact vector counts,
  profile/dimension validation, stale-generation rejection, transactional rollback preservation,
  source readiness, and retry-safe diagnostics
- **Query embedding boundary:** verify stable normalization and ordering for every configured query
  source, one profile-aware batch call, profile-tagged copy-safe vectors, safe count/profile/
  timing diagnostics, all-or-nothing profile/dimension/count/finite/provider failures, and no raw
  vectors or provider payloads in logs
- **Retrieval contract boundary:** verify the single query-source/variant union, vector-candidate and
  trace ownership, provider-neutral outcome/failure codes, cosine distance/similarity semantics,
  and explicit internal-to-public/runtime mapper redaction and normalization
- **Typed retrieval:** verify one embedding operation, bounded vector searches, domain separation
  (`avatar_knowledge` / `world` / `media`), deterministic similarity ranking/deduplication under fixed
  fixtures, balanced source minimums, controlled failures, and trace metadata (`sourceId`,
  `chunkId`, `distance`, `similarity`, `reason`)
- **Avatar-scoped visibility:** verify deterministic exclusion of non-visible knowledge per active avatar, avatar-switch scope updates, and bounded visibility explainability counters in retrieval/context traces
- **Visibility asymmetry:** verify avatar filtering remains enforced while GM retrieval diagnostics prove unrestricted omniscient scope (`gmUnrestricted`, `gmRetrievalCounts`) without content leakage
- **Filtered vector repository:** verify PostgreSQL cosine order, limit-after-filter behavior, active profile/generation, source/type/scenario/readiness, shared-candidate behavior, visibility truth-table behavior, GM-bypass limits, dimension/profile failures, and an index-compatible `ORDER BY embedding <=> query LIMIT` shape; use the in-memory implementation for deterministic unit coverage
- **Knowledge API operator flow:** verify stack-e2e coverage for auth, validation, not-found, and happy-path source->ingestion->retrieval flow
- **Console operator adapters:** verify `apps/console` knowledge API wrappers and Session Admin knowledge action helpers reuse shared DTOs and map operator-facing errors
- **Unified retrieval diagnostics:** verify admin responses, recorded turn events, session-context
  projections, and console/admin displays consume shared profile/timing/count/distance/failure
  fields, preserve older event payloads, and never serialize vectors or provider payloads
- **Operator category separation:** verify admin/console displays visibly group the three static
  knowledge categories separately from working memory, episodic memory, and long-term user facts;
  verify source scenario/Avatar visibility and memory user/session/conversation scope are shown in
  their owning surfaces
- **Quarantine-safe output:** verify blocked source projections expose only classification, reason,
  offending key names, and timestamp; nested source content and vector metadata are redacted
- **Lifecycle boundaries:** verify reset clears messages and owned conversational memory without
  knowledge changes, conversation close creates episodic memory without RAG rows, scenario deletion
  owns knowledge cascade, reindex does not alter memory rows, and memory maintenance does not alter
  chunks, embeddings, source status, or corpus generation.
- **EPIC 4.2d isolation proof:** verify identical static retrieval for different callers with the
  same scenario/query/Avatar visibility, isolation of working/episodic/fact layers, separated
  prompt sections and provenance, deterministic alias/quarantine behavior, and absence of
  retrieved-context contamination in fact extraction. The complete matrix is
  [EPIC_4_2D_REQUIREMENTS_MATRIX.md](EPIC_4_2D_REQUIREMENTS_MATRIX.md).
- **EPIC 5.1d quality proof:** use exact-vector semantic fixtures for multilingual paraphrases and
  unrelated candidates, then verify the application boundary, filtered repository, runtime failure
  isolation, and production composition. The complete requirements-to-tests matrix is
  [EPIC_5_1D_REQUIREMENTS_MATRIX.md](EPIC_5_1D_REQUIREMENTS_MATRIX.md). PostgreSQL and stack
  evidence remains environment-gated; deterministic unit tests must not weaken those checks.
- **Audit log:** verify that every admin action writes an entry with the correct `actionType`, `targetType`, and `targetId`
- **Auth:** verify that admin endpoints require a valid API key (same as public API in Phase A)
- **No sensitive data leakage:** verify that session event payloads and admin responses do not expose raw prompt content or credential values
- **GM invalid-output diagnostics:** verify that parse-failure traces contain bounded metadata only,
  with no raw prompt, user message, or model response content
- **Stack E2E health shape:** verify `GET /v1/admin/health` auth behavior and response envelope/shape without hardcoding dependency statuses

---

# Test Tiers

Four tiers. The file suffix determines which Vitest config runs it and which CI gate owns it.

| Suffix                  | Tier        | Vitest config                  | CI gate                    |
| ----------------------- | ----------- | ------------------------------ | -------------------------- |
| `*.test.ts`             | Unit        | `vitest.config.ts`             | PR (always runs, blocking) |
| `*.integration.test.ts` | Integration | `vitest.integration.config.ts` | Main push + nightly        |
| `*.e2e.test.ts`         | E2E         | `vitest.integration.config.ts` | Main push + nightly        |
| `*.stack-e2e.test.ts`   | Stack E2E   | `vitest.stack-e2e.config.ts`   | Nightly only               |

### Unit (`*.test.ts`)

No network. No real providers. No real DB. Always fast, always deterministic. Hard PR gate — failure blocks merge. The largest part of the suite.

**Game Master unit test categories:**

- **Prompt contract** (`gm-prompt.service.test.ts`, `gm-input-renderer.test.ts`): static and dynamic GM prompt builders keep stable section order, preserve validation-critical instructions, omit empty optional sections cleanly, and keep the empty-input session-start path explicit.
- **State reducer** (`gm-state-reducer.test.ts`): progression/routing mutations, preservation of application-owned interaction counts, all-undefined update, and non-mutation of input state. Covered topics and memory fields are not part of GM reduction.
- **Async use case** (`run-game-master.use-case.test.ts`): every completed avatar turn calls the GM LLM with a `vi.fn()` mock returning hardcoded JSON matching `GameMasterOutput`, the actual `systemPrompt` and rendered user message content are asserted from the `llm.complete` request, state is reduced, notes are stored, valid unlocks are persisted, valid explicit switches record the next active Avatar without mutating conversation lifecycle, the platform handoff path is proven separately, invalid avatar IDs are ignored, JSON parse/shape errors increment state and emit `gm_error`, LLM and persistence errors are diagnosed, event log shape verifies `gm_triggered` / `gm_error` fields, and event payload security confirms no `userMessageText`, raw system prompt text, or rendered prompt sections are emitted.
- **Memory contradiction policy** (`memory-contradiction.policy.test.ts`): a contradicted
  natural-language Avatar claim is excluded, while later user support or verified canonical context
  preserves the candidate fact.

### Integration (`*.integration.test.ts`)

Real adapter collaboration: real PostgreSQL for repositories, real Redis when Redis semantics matter, mocked LLM providers unless specifically testing provider integration. Tests requiring live credentials use `describe.skipIf(!apiKey)` — skipped in CI without credentials, run in nightly with credentials. If a live provider smoke call returns a recognized transient availability or quota failure (for example 429, 5xx, timeout, or no credits), the test is dynamically skipped; invalid credentials and unexpected adapter/contract failures remain blocking within the test job.

The evaluator package has one documented exception to the usual infrastructure-oriented integration
examples: `evaluation.integration.test.ts` is an integration-style composition test over a fake
HTTP boundary. It must remain deterministic and must not require Core, infrastructure, network
access, or provider credentials.

Representative GM integration test files:

- `postgres-gm-state.repository.integration.test.ts` — verifies `findBySessionId`, `save` (insert and upsert), orchestration/count round-trip, and legacy GM memory/avatar columns being ignored
- `postgres-event-log.repository.integration.test.ts` — verifies `append` inserts rows, JSONB payload round-trip, nullable `sessionId`, and `correlation_id` lookup
- `run-game-master.integration.test.ts` — verifies the composed refined GM prompt path with real in-memory adapters and services: bounded memory selection, typed retrieval, latest-exchange rendering, persisted GM notes/state, emitted runtime suggestion events, safe event logging, and observability trace metadata carrying prompt-version identifiers

### E2E (`*.e2e.test.ts`)

Full HTTP-stack flows through an **in-process** Fastify server (`inject()` — no real TCP). Same `describe.skipIf` guard convention. Tests using `null` LLM always execute; provider-dependent tests are skipped unless the key is present.
Example naming is current and enforced by practice (e.g., `exchange.e2e.test.ts`, `messages.e2e.test.ts`).

### Stack E2E (`*.stack-e2e.test.ts`)

Real HTTP requests against a live Docker stack (production image + postgres + redis). The only tier that exercises the production binary end-to-end. Requires `APP_URL`. Auth/schema tests are always-on (`LLM_PROVIDER=null`); real-provider tests use `describe.skipIf`. Nightly only.

### Do not mix tiers in one file

- `*.test.ts` — no network calls, no real providers
- `*.integration.test.ts` — no assertions on prompt prose quality; structural request-contract assertions are allowed when the real consumer boundary is the actual LLM request
- `*.e2e.test.ts` — no real TCP connections, uses `inject()` only
- `*.stack-e2e.test.ts` — no Fastify imports, no internal state assertions

---

# Writing Tests

## Mocks

**Rule: mock only at infrastructure adapter boundaries.**

- Domain and application tests: use `vi.fn()` references declared at module level
- API route tests: inject `NullLlmAdapter` / `NullObservabilityAdapter` via options — never mock internals
- Never mock domain logic, use case classes, or repository interfaces in API tests

## LLM tests

Default in CI: fakes and deterministic mocks. Real provider calls only for:

- wrapper smoke tests (integration tier, `describe.skipIf` guarded)
- nightly benchmark runs
- pre-release critical flow checks

When asserting against real LLMs, prefer: schema validity, field presence, bounded latency, no provider crash. Avoid: exact sentence matching, brittle phrasing assertions.

## Gating real-provider tests

```ts
const apiKey = process.env['OPENAI_API_KEY']
describe.skipIf(!apiKey)('with real OpenAI', () => {
  it('returns a non-empty reply', async () => { ... }, 30_000)
})
```

Live-provider tests also use the test context to skip recognized transient provider failures after the request. This keeps exhausted nightly provider accounts from reporting a product regression while preserving failures for authentication, response-shape, and adapter-contract errors.

## Fixtures

- Keep fixtures small and explicit
- Scenario-based, not generic
- Adversarial and edge-case inputs are as important as happy-path ones
- Never use real user data without anonymization
- Fixture changes are reviewed like code changes

---

# CI Gates

| Trigger | Blocking | Checks                                                                     |
| ------- | -------- | -------------------------------------------------------------------------- |
| PR      | Yes      | lint, typecheck, unit tests, SAST, secrets scan, docker build              |
| Main    | Yes      | all PR checks + integration + E2E + image scan + perf smoke                |
| Nightly | No       | real-provider smoke, mutation, regression pack, DAST, soak/perf, stack-e2e |
| Release | Yes      | full gate + production smoke                                               |

Every PR and push also runs a `docker-build` job (builds the production image, no push). This ensures the image compiles on every commit, not only at release.

---

# Running Tests

```
pnpm test                  # unit tests (PR gate)
pnpm test:integration-e2e  # integration + E2E (main / nightly)
pnpm test:stack-e2e        # stack E2E — requires a running Docker stack
pnpm test:coverage         # unit tests with coverage report
pnpm --filter @gami/conversation-evaluation test:integration-style # deterministic evaluator HTTP composition
```

Stack E2E preflight behavior:

- local default: if `APP_URL` is unreachable, stack tests are skipped with a preflight reason so local audit runs do not fail for missing infrastructure
- strict mode: set `STACK_E2E_REQUIRE_APP=1` (or run in CI where `CI=true`) to keep the current hard-fail behavior when the stack is unavailable

---

# Coverage Thresholds

Enforced in `vitest.config.ts` via `@vitest/coverage-v8`. Build fails if any threshold is not met:

| Metric     | Threshold |
| ---------- | --------- |
| Statements | >= 80%    |
| Branches   | >= 80%    |
| Functions  | >= 80%    |
| Lines      | >= 80%    |

Excluded from coverage: `*.types.ts`, `application/ports/**`, `infrastructure/cache/**`, `infrastructure/db/**`, `index.ts`.

**Current baseline (post-EPIC 3.1 health hardening):** unit suite: 289 tests · 55 test files; integration suite adds `PostgresGmStateRepository` and `PostgresEventLogRepository` test files (guarded by `DB_AVAILABLE`)

---

# Tooling

| Tool                    | Version | Purpose                                  |
| ----------------------- | ------- | ---------------------------------------- |
| **Vitest**              | 3.2.4   | Test runner (unit, integration, E2E)     |
| **@vitest/coverage-v8** | 3.2.4   | Coverage via V8 native instrumentation   |
| **Fastify `inject()`**  | —       | In-process HTTP simulation for E2E tests |

---

# When a Bug Is Found

1. Reproduce it with a failing test
2. Fix it
3. Verify no broader regression

Do not only patch behavior. If the bug escaped because of a test gap, add the test that would have caught it.

---

# What We Intentionally Do Not Do

- test every private helper
- snapshot full AI outputs
- run expensive real-provider tests on every PR
- over-mock all architecture boundaries
- use massive E2E suites as a substitute for unit tests
- pretend AI behavior is fully deterministic
- add an evaluation platform before MVP needs it

Knowledge corpus persistence tests cover deterministic in-memory parity and PostgreSQL lifecycle
behavior. The PostgreSQL suite verifies fixed-dimension/profile constraints, legacy vector
invalidation assumptions, staging isolation, idempotent source replacement, failed promotion
preservation, active-source transactional replacement, stale publication rejection, and the atomic
active-pointer switch. Reindex tests additionally cover source-set snapshotting, duplicate starts,
single-worker claims, failed-source retry, interrupted-worker recovery, completeness blocking, and
operator route authentication/validation/not-found envelopes. Every reindex route has a colocated
opt-in stack-e2e contract test. Integration tests remain skipped when
`DATABASE_URL` is unavailable.
