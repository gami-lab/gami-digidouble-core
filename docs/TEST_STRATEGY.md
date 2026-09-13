# Test strategy

Tests protect contracts and risks, not implementation volume. Prefer deterministic tests and keep
provider/database/stack dependencies explicit.

## Principles

- Test from the consumer boundary inward.
- Unit-test domain policies and orchestration with deterministic ports.
- Integration-test repositories, schema assumptions, adapters, and application composition.
- Test HTTP routes as contracts: auth, validation, error envelope, success shape, and cancellation.
- Keep provider behavior behind injectable transports; live-provider checks are opt-in.
- Never assert writing style. Assert structure, safety, ownership, ordering, and failure behavior.
- Test admin/inspection projections for redaction and boundedness, not internal object identity.

## Tiers

- `*.test.ts` — deterministic unit/consumer tests.
- `*.integration.test.ts` — real adapter or database boundary, environment-gated when needed.
- `*.e2e.test.ts` — critical flow in one process with fakes where appropriate.
- `*.stack-e2e.test.ts` — real HTTP stack and infrastructure; must clearly report preflight skips or fail in strict CI mode.

Do not mix tiers in one file. A test should state which external dependency it requires.

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
- paragraph-aware chunking and ingestion lifecycle
- embedding profile/dimension validation and ordered complete batches
- staged reindex completeness, restart/retry safety, rollback, and atomic promotion
- vector filtering, visibility asymmetry, deterministic merge/dedup/selection, and safe failures
- retrieval/context diagnostics contain no vectors, credentials, prompts, or unbounded content

### Boundaries

- API/shared DTO ownership and mapper behavior
- model/provider resolution and unsupported configuration
- PostgreSQL schema/index contract and Redis coordination behavior
- admin actions and inspection redaction
- frontend consumers use canonical routes and do not duplicate Core business rules

## Provider and stack checks

Use null/fake adapters by default. Gate real OpenAI/Anthropic/Mistral/xAI, Deepgram, Gradium,
PostgreSQL, Redis, and stack checks on explicit environment configuration. Recognized transient
provider outages may be skipped in local runs but must remain visible in CI output.

## Regression rule

Every bug fix adds a test at the boundary that reproduces the bug. Every contract change updates the
shared type, route/consumer tests, and the relevant source-of-truth document. Remove tests for
deleted compatibility behavior instead of preserving aliases just to keep them green.
