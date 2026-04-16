# Implement the First Exchange Use Case

## Context

With the LLM adapter (Prompt 01) and observability adapter (Prompt 02) in place, this prompt wires them together in the application layer as a working use case: `SendRawMessage`.

This is the first end-to-end AI interaction in the codebase — a user sends a text message and gets a model response back, with full metrics captured. It is intentionally minimal: no session, no memory, no persona, no scenario. Those concerns belong to later EPICs.

The goal is to prove the pipeline works and that observability is captured on every call.

## Scope

What must be implemented now:

- `SendRawMessage` use case in `application/`.
- Port-only access: use case depends on `ILlmAdapter` and `IObservabilityAdapter` — never on concrete classes.
- A unique `requestId` generated per call (e.g. `crypto.randomUUID()`).
- Trace recorded for every call via the observability adapter.
- Input/output DTO types for the use case.
- Unit tests with `NullLlmAdapter` and `NullObservabilityAdapter`.

What is out of scope:

- Session management — EPIC 2.1+.
- Memory or context assembly — EPIC 4.2.
- Persona/avatar system prompt — EPIC 2.1.
- GM trigger — EPIC 2.2.
- Streaming — EPIC 3.3.
- Authentication — already handled at API layer.

## Relevant Docs

- `docs/ARCHITECTURE.md` — Application layer responsibilities; use case structure
- `docs/PRINCIPLES.md` — Principle: Orchestration over Generation; Observe from day one
- `docs/TEST_STRATEGY.md` — Unit tests for application logic; test with mocks not live adapters
- `apps/core/src/application/ports/ILlmAdapter.ts`
- `apps/core/src/application/ports/IObservabilityAdapter.ts`

## Implementation Guidance

### File structure

```
apps/core/src/application/
  use-cases/
    send-raw-message/
      send-raw-message.use-case.ts
      send-raw-message.types.ts
      send-raw-message.use-case.test.ts
```

### Input and output types (`send-raw-message.types.ts`)

```ts
// Input
export interface SendRawMessageInput {
  userMessage: string
  systemPrompt?: string // optional override; defaults to a plain assistant prompt
}

// Output
export interface SendRawMessageOutput {
  requestId: string
  reply: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}
```

### Use case (`send-raw-message.use-case.ts`)

The use case class receives both adapters via constructor injection — no direct imports of concrete adapters.

```ts
// Rough shape
class SendRawMessageUseCase {
  constructor(
    private readonly llm: ILlmAdapter,
    private readonly observability: IObservabilityAdapter,
  ) {}

  async execute(input: SendRawMessageInput): Promise<SendRawMessageOutput>
}
```

Execution steps:

1. Generate `requestId` via `crypto.randomUUID()`.
2. Build `LlmRequest` from input (default system prompt: `"You are a helpful assistant."`).
3. Call `this.llm.complete(request)` and capture `LlmResponse`.
4. Call `this.observability.trace(...)` with all metrics — do not await this if you want it non-blocking, but handle the promise (no floating promises).
5. Return `SendRawMessageOutput` mapped from `LlmResponse` + `requestId`.

### Default system prompt

When `input.systemPrompt` is absent, use a minimal neutral prompt:

```
You are a helpful assistant.
```

This will be replaced by proper persona prompts in EPIC 2.1. Keep it simple here.

### Error handling

- If `llm.complete()` throws, let it propagate — the API layer handles it.
- If `observability.trace()` fails, catch the error, log a warning to stderr, and continue. Observability errors must not break the exchange.

### Unit tests

- Test happy path: `NullLlmAdapter` returns response, `NullObservabilityAdapter` records trace.
- Test that `requestId` is a non-empty string on every call.
- Test that `observability.trace()` is called exactly once per execution.
- Test that a custom `systemPrompt` is passed through to the LLM request.
- Do not test LLM quality — test structure, contract, and call count.

## Constraints

- Application layer must only import from `application/ports/` — never from `infrastructure/`.
- Use `crypto.randomUUID()` (native Node 22) — no external UUID library needed.
- TypeScript strict mode — no `any`.
- `max-lines-per-function` ≤ 50 — the `execute()` method must remain small.
- The use case must be instantiatable with any `ILlmAdapter` implementation — the factory/wiring happens outside (API layer or future DI container).

## Deliverables

- `apps/core/src/application/use-cases/send-raw-message/send-raw-message.types.ts`
- `apps/core/src/application/use-cases/send-raw-message/send-raw-message.use-case.ts`
- `apps/core/src/application/use-cases/send-raw-message/send-raw-message.use-case.test.ts`
- All tests pass with no network access or API key required
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (required — mark EPIC 1.2 prompt 03 done)
- `docs/ARCHITECTURE.md` — confirm the Application layer section reflects the use-case pattern now in place

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- `SendRawMessageUseCase.execute()` returns a valid `SendRawMessageOutput`.
- `observability.trace()` is called once per `execute()` call.
- Observability failures are swallowed without crashing the use case.
- No concrete adapter class is imported in the use case file.
- Unit tests pass without any LLM API key or network connectivity.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass.
