# Implement the Observability Adapter

## Context

EPIC 1.2 requires observability from day one. The `IObservabilityAdapter` port is already defined in `apps/core/src/application/ports/IObservabilityAdapter.ts` and the placeholder stub lives in `apps/core/src/infrastructure/observability/index.ts`.

This prompt implements a concrete Langfuse adapter that records each LLM call as a trace — capturing request ID, latency, token counts, cost, and metadata. It also implements a `ConsoleObservabilityAdapter` for local development and a `NullObservabilityAdapter` for tests.

Observability is not optional. Every LLM call in this system must be traced from the first interaction.

## Scope

What must be implemented now:

- Concrete `LangfuseObservabilityAdapter` implementing `IObservabilityAdapter`.
- `ConsoleObservabilityAdapter` — logs trace events as structured JSON to stdout. Used when Langfuse is not configured.
- `NullObservabilityAdapter` — no-op, used in tests.
- Factory function `createObservabilityAdapter(config)` returning the right adapter.
- `flush()` must be called before process exit (wire into the app shutdown sequence).
- Install the Langfuse Node SDK in `apps/core`.

What is out of scope:

- User feedback collection (thumbs up/down) — Phase B.
- Background quality evaluation — Phase B.
- Custom dashboards or metric exports — EPIC 5.3.
- Tracing GM calls specifically — that's part of EPIC 2.2.

## Relevant Docs

- `docs/TECH_STACK.md` — Section 12 (Observability)
- `docs/ARCHITECTURE.md` — Infrastructure layer, Observability module
- `docs/PRINCIPLES.md` — Principle: Measure Everything That Matters; Observe from day one
- `apps/core/src/application/ports/IObservabilityAdapter.ts` — the interface to implement
- `apps/core/src/infrastructure/observability/index.ts` — placeholder to replace

## Implementation Guidance

### File structure

```
apps/core/src/infrastructure/observability/
  index.ts                      ← factory: createObservabilityAdapter(config) → IObservabilityAdapter
  langfuse.adapter.ts           ← LangfuseObservabilityAdapter implements IObservabilityAdapter
  console.adapter.ts            ← ConsoleObservabilityAdapter (structured JSON stdout)
  null.adapter.ts               ← NullObservabilityAdapter for tests
```

### LangfuseObservabilityAdapter

- Accepts `publicKey`, `secretKey`, and `host` in its constructor.
- `trace(event: TraceEvent)`: creates a Langfuse generation or trace event.
- Maps `TraceEvent` fields → Langfuse generation fields:
  - `requestId` → trace/generation ID
  - `event` → name
  - `latencyMs` → latency
  - `inputTokens` / `outputTokens` → usage
  - `costUsd` → cost if Langfuse supports it
  - `metadata` → metadata object
- `flush()`: calls `langfuse.shutdownAsync()` or equivalent to drain the queue.
- Errors from Langfuse must be caught and logged — observability must never crash the main flow.

### ConsoleObservabilityAdapter

- `trace(event)`: writes `JSON.stringify(event)` to stdout via `console.log`.
- `flush()`: no-op (resolves immediately).
- Used when `LANGFUSE_PUBLIC_KEY` is absent in config.

### NullObservabilityAdapter

- Both `trace()` and `flush()` are no-ops that resolve immediately.
- Used in all unit and integration tests.

### Factory function

```ts
function createObservabilityAdapter(config: ObservabilityConfig): IObservabilityAdapter
```

- Returns `LangfuseObservabilityAdapter` when Langfuse keys are present.
- Falls back to `ConsoleObservabilityAdapter` when keys are absent.
- `ObservabilityConfig` derived from app `Config`.

### App shutdown wiring

- In `apps/core/src/index.ts`, wire a `process.on('SIGTERM', ...)` and `process.on('SIGINT', ...)` handler that calls `observabilityAdapter.flush()` before exiting.
- This ensures no traces are lost on graceful shutdown (or container stop).

### Config integration

- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` are already in `.env.example` as optional.
- Add optional `langfusePublicKey`, `langfuseSecretKey`, `langfuseHost` fields to `Config`.
- These must not be required — the app must start without them (falls back to console adapter).

## Constraints

- Langfuse SDK imports confined to `infrastructure/observability/`.
- Observability errors must be silently swallowed (log to stderr, then continue) — never propagate to callers.
- TypeScript strict mode — no `any`.
- `flush()` must be safe to call multiple times with no side effects.
- `max-lines-per-function` ≤ 50.

## Deliverables

- `apps/core/src/infrastructure/observability/langfuse.adapter.ts`
- `apps/core/src/infrastructure/observability/console.adapter.ts`
- `apps/core/src/infrastructure/observability/null.adapter.ts`
- `apps/core/src/infrastructure/observability/index.ts` — factory replacing placeholder
- Updated `apps/core/src/config.ts` with optional Langfuse config fields
- Updated `apps/core/src/index.ts` with graceful shutdown flush
- Unit tests for each adapter (Langfuse SDK calls mocked)
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (required — mark EPIC 1.2 prompt 02 done)
- `docs/TECH_STACK.md` — update observability validation notes if relevant

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- `LangfuseObservabilityAdapter` records a trace when `trace()` is called with valid keys configured.
- `ConsoleObservabilityAdapter` writes structured JSON to stdout.
- `NullObservabilityAdapter` is silent and never throws.
- Factory returns the correct adapter based on config.
- App shuts down gracefully flushing pending traces.
- Langfuse SDK errors do not crash the process.
- Unit tests pass without a live Langfuse instance.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass.
- No `any` types introduced.
