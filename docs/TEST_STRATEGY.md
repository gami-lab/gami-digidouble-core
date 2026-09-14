# Test strategy

Tests protect contracts and risks, not implementation volume. Prefer deterministic tests and keep
provider/database/stack dependencies explicit. Application-specific coverage targets (what to test
per module) live in [TEST_COVERAGE_PLAN.md](TEST_COVERAGE_PLAN.md).

## Principles

- Test from the consumer boundary inward: for anything crossing a boundary (SDK, adapter, queue,
  external API, observability event), enumerate what the downstream consumer actually needs and
  assert every field explicitly. A test that only checks what the code already does — rather than
  what the consumer requires — is green by construction and misses whatever the implementation
  forgot. High line coverage does not substitute for this.
- Unit-test domain policies and orchestration with deterministic ports.
- Integration-test repositories, schema assumptions, adapters, and application composition.
- Test HTTP routes as contracts: auth, validation, error envelope, success shape, and cancellation.
- Test shared client protocol guards and pure contract mappers in `packages/shared`; keep JSON
  request, streaming, binary, and abort behavior covered at each app boundary.
- Test the application exchange-window selector for ordering, complete-pair rules, caps, and
  working-memory fallback; test infrastructure timeout signals and web terminal/storage helpers at
  their owning boundaries.
- Keep provider behavior behind injectable transports; live-provider checks are opt-in.
- The retrieval-quality harness supplements conversation evaluation with labelled recall@k/MRR; its live OpenAI run is opt-in and is not a CI gate.
- Knowledge ingestion tests cover paragraph splitting, the hard per-chunk character ceiling, bounded
  deterministic overlap, metadata/header preservation, and reindex reuse of the same chunking path.
- Never assert writing style. Assert structure, safety, ownership, ordering, and failure behavior.
- Test admin/inspection projections for redaction and boundedness, not internal object identity.
- Mock only at infrastructure adapter boundaries: domain/application tests use `vi.fn()` references
  declared at module level; API route tests inject `NullLlmAdapter`/`NullObservabilityAdapter` (or
  equivalent) via options. Never mock domain logic, use-case classes, or repository interfaces
  directly in API tests.
- When asserting against real LLMs, prefer schema validity, field presence, and bounded latency over
  exact sentence matching or brittle phrasing assertions — AI output is not fully deterministic.

## Tiers

- `*.test.ts` — deterministic unit/consumer tests. No network, no real providers, no real DB.
  Always fast, always the PR gate — failure blocks merge. The largest part of the suite.
- `*.integration.test.ts` — real adapter or database boundary (real PostgreSQL for repositories,
  real Redis when Redis semantics matter), mocked LLM providers unless specifically testing provider
  integration. Environment-gated with `describe.skipIf` when credentials/DB are absent.
- `*.e2e.test.ts` — critical flow in one process through an in-process Fastify server (`inject()` —
  no real TCP), with fakes where appropriate.
- `*.stack-e2e.test.ts` — real HTTP requests against a live Docker stack (production image +
  Postgres + Redis); the only tier that exercises the production binary end-to-end. Requires
  `APP_URL`. Auth/schema checks stay always-on with `LLM_PROVIDER=null`; real-provider checks use
  `describe.skipIf`.

Do not mix tiers in one file. A test should state which external dependency it requires.

Stack E2E preflight: locally, an unreachable `APP_URL` skips the stack suite with a printed
preflight reason so audits do not fail for missing infrastructure. Set
`STACK_E2E_REQUIRE_APP=1` (or run where `CI=true`) to keep the strict hard-fail behavior instead.

| Trigger   | Blocking | Checks                                                        |
| --------- | -------- | ------------------------------------------------------------- |
| PR        | Yes      | lint, typecheck, unit tests, SAST, secrets scan, docker build |
| Main push | Yes      | all PR checks + integration + E2E + image scan + perf smoke   |
| Nightly   | No       | real-provider smoke, regression pack, stack-e2e               |
| Release   | Yes      | full gate + production smoke                                  |

## Required risk coverage

### Runtime

- lifecycle: start, end, switch, reset, history, and active-Avatar invariants
- Avatar prompt/context precedence and response cleanup
- GM strict parsing, safe reduction, async behavior, stale-plan suppression, and event redaction
- memory layer ownership, bounded selection, compaction, contradiction filtering, and isolation
- streaming ordering, interruption, cleanup, exact-once persistence, and JSON-route compatibility
- voice identity/idempotency, cancellation, provider failures, and text-route continuity
- audio lookup/format/size identity, transient delivery, and text fallback

### Knowledge

- canonical types and reserved metadata rejection
- paragraph-aware chunking, oversized paragraph/code-fence splitting, bounded overlap, and ingestion lifecycle
- embedding profile/dimension validation and ordered complete batches
- staged reindex completeness, same-profile reuse through the admin start route, restart/retry safety,
  rollback, and atomic promotion at the PostgreSQL boundary
- vector and bounded lexical filtering, visibility asymmetry, deterministic fusion/merge/dedup/selection,
  and safe failures, including a real PostgreSQL service-level hybrid retrieval check
- retrieval/context diagnostics contain no vectors, credentials, prompts, or unbounded content

### Boundaries

- API/shared DTO ownership and mapper behavior
- model/provider resolution and unsupported configuration
- PostgreSQL schema/index contract and Redis coordination behavior
- admin actions and inspection redaction
- frontend consumers use canonical routes and do not duplicate Core business rules

## Provider and stack checks

Use null/fake adapters by default. Gate real OpenAI/Anthropic/Mistral/xAI, Deepgram, Gradium,
PostgreSQL, Redis, and stack checks on explicit environment configuration (for example
`OPENAI_API_KEY`, `DATABASE_URL`, `VOICE_STACK_E2E=1`, `DEEPGRAM_LIVE_SMOKE=1`). Recognized
transient provider outages (429/5xx/timeout/no-credits) may be dynamically skipped in local and
nightly runs but must remain visible in output; invalid credentials and unexpected adapter/contract
failures still block the job.

## Coverage thresholds

Enforced in `vitest.config.ts` via `@vitest/coverage-v8`. Build fails if any threshold is not met:

| Metric                                    | Threshold |
| ----------------------------------------- | --------- |
| Statements / Branches / Functions / Lines | >= 80%    |

Excluded from coverage: `*.types.ts`, `application/ports/**`, `infrastructure/cache/**`,
`infrastructure/db/**`, `index.ts`.

## Running tests

```
pnpm test                  # unit tests (PR gate)
pnpm test:integration-e2e  # integration + E2E (main / nightly)
pnpm test:stack-e2e        # stack E2E — requires a running Docker stack
pnpm test:coverage         # unit tests with coverage report
```

## What we intentionally do not do

- test every private helper
- snapshot full AI outputs
- run expensive real-provider tests on every PR
- over-mock all architecture boundaries
- use massive E2E suites as a substitute for unit tests
- pretend AI behavior is fully deterministic
- add an evaluation platform before MVP needs it

## When a bug is found

1. Reproduce it with a failing test.
2. Fix it.
3. Verify no broader regression.

Do not only patch behavior — if the bug escaped because of a test gap, add the test that would have
caught it.

## Regression rule

Every bug fix adds a test at the boundary that reproduces the bug. Every contract change updates the
shared type, route/consumer tests, and the relevant source-of-truth document. Remove tests for
deleted compatibility behavior instead of preserving aliases just to keep them green.
