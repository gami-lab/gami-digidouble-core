# TEST_STRATEGY.md

How we build and design tests for this project.
Application-specific coverage targets (what to test per module) are in [TEST_COVERAGE_PLAN.md](TEST_COVERAGE_PLAN.md).

---

# Principles

## 1. Test the risk, not the code volume

Prioritize where failure is costly or hard to detect. High-risk areas: session lifecycle, context assembly, Game Master decisions, memory logic, API contracts, provider wrappers. Low-risk: thin pass-through mappings, obvious DTO plumbing.

## 2. Prefer deterministic tests first

When logic can be tested without an LLM, it must be. LLM calls are slower, costlier, and less stable. Use real providers only where they validate something that cannot be faked.

## 3. Separate product logic from provider behavior

We do not test OpenAI, Anthropic, or Mistral. We test our wrapper, our retry/timeout/fallback logic, our schema enforcement, and our orchestration around providers. Provider quality comparisons belong to benchmarks, not CI.

## 4. Test contracts aggressively

Contract breakage is one of the biggest risks in a modular API-first system. Protect: HTTP request/response shapes, streaming event shapes, Game Master I/O contracts, scenario config schema, repository interfaces. Any breaking change requires a version bump and an update to [API_CONTRACT.md](API_CONTRACT.md).

## 5. Assert from the consumer inward, not from the implementation outward

The most dangerous test gap is a test that passes because it only checks what the code already does, not what the consumer requires.

**Wrong (implementation-mirroring):** Write production code, then assert on the fields it already sets. Green by construction — any field the implementation forgot is untested.

**Required (consumer-contract):** Before writing production code, ask _"what must the consumer observe for this to actually work?"_ For an observability adapter, the consumer is the Langfuse dashboard — assert `input`, `output`, `usage`, `metadata`. For a use case trace call, assert the actual message content and reply, not only token counts.

**Rule:** When asserting on an object passed to any boundary (SDK, adapter, queue, external API), enumerate what the downstream consumer needs and assert every field explicitly. High coverage does not substitute for this.

## 6. Keep the suite useful

Fewer focused tests beat many brittle ones. Prefer: clear naming, simple fixtures, explicit arrange/act/assert. Avoid: giant opaque fixtures, snapshot abuse, overly clever helpers, giant E2E suites standing in for unit tests.

---

## 7. Test the Admin plane as a contract, not an internal detail

Admin endpoints have consumers: operators, back-office UIs, monitoring systems.

Treat them with the same contract discipline as the public API.

Required tests:

- **Health aggregation:** verify that each dependency state (`ok` / `degraded` / `error`) produces the correct top-level status
- **Dependency probe:** verify that a simulated postgres timeout returns `status: 'degraded'`, not `status: 'ok'`
- **Session inspector:** verify the shape of returned state — messages, memory, GM state, events — not just that it doesn't crash
- **Reset:** verify that reset deletes messages and memory but keeps the session record; verify the audit log entry is created
- **Replay:** verify that replayed turn does NOT write a new message to the DB
- **Ingestion retry:** verify that retrying a completed job returns current status rather than creating a duplicate run
- **Audit log:** verify that every admin action writes an entry with the correct `actionType`, `targetType`, and `targetId`
- **Auth:** verify that admin endpoints require a valid API key (same as public API in Phase A)
- **No sensitive data leakage:** verify that session event payloads and admin responses do not expose raw prompt content or credential values

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

### Integration (`*.integration.test.ts`)

Real adapter collaboration: real PostgreSQL for repositories, real Redis when Redis semantics matter, mocked LLM providers unless specifically testing provider integration. Tests requiring live credentials use `describe.skipIf(!apiKey)` — skipped in CI without credentials, run in nightly with credentials.

### E2E (`*.e2e.test.ts`)

Full HTTP-stack flows through an **in-process** Fastify server (`inject()` — no real TCP). Same `describe.skipIf` guard convention. Tests using `null` LLM always execute; provider-dependent tests are skipped unless the key is present.
Example naming is current and enforced by practice (e.g., `exchange.e2e.test.ts`, `messages.e2e.test.ts`).

### Stack E2E (`*.stack-e2e.test.ts`)

Real HTTP requests against a live Docker stack (production image + postgres + redis). The only tier that exercises the production binary end-to-end. Requires `APP_URL`. Auth/schema tests are always-on (`LLM_PROVIDER=null`); real-provider tests use `describe.skipIf`. Nightly only.

### Do not mix tiers in one file

- `*.test.ts` — no network calls, no real providers
- `*.integration.test.ts` — no assertions on prompt wording or prose quality
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
```

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

**Current baseline (post-EPIC 2.1):** 94.9% statements · 85.64% branches · 100% functions · 91 tests · 15 files

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
