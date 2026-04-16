# Implement the LLM Provider Adapter

## Context

EPIC 1.2 starts by making the existing `ILlmAdapter` port real. The port interface is already defined in `apps/core/src/application/ports/ILlmAdapter.ts` and the infrastructure placeholder stub is in `apps/core/src/infrastructure/llm/index.ts`.

This is the most critical piece of the EPIC: everything upstream (use cases, API) depends on a working adapter. The adapter must remain completely isolated behind the interface — no provider SDK must ever leak into domain or application code.

## Scope

What must be implemented now:

- Concrete `OpenAiAdapter` implementing `ILlmAdapter` using the OpenAI Node SDK.
- Timeout and retry handling inside the adapter (not in business logic).
- Accurate token and latency capture from the provider response.
- A `NullLlmAdapter` for testing: returns a fixed response, never makes network calls.
- Skeleton `AnthropicAdapter` stub (implements the interface, throws `NotImplementedError` until EPIC 2.x).
- Provider registration: a factory function that returns the right adapter based on config.
- Install the OpenAI Node SDK in `apps/core`.

What is out of scope:

- Streaming (`stream()` method) — deferred to EPIC 3.3.
- Embedding support — deferred to EPIC 4.1.
- Mistral adapter — skeleton stub only.
- Model-role assignment (Avatar model vs GM model) — deferred to EPIC 2.1.
- Prompt template logic — not this layer's concern.

## Relevant Docs

- `docs/TECH_STACK.md` — Section 6 (LLM Layer) and Section 7 (LLM Providers)
- `docs/ARCHITECTURE.md` — Infrastructure layer and Port/Adapter contracts
- `docs/PRINCIPLES.md` — Principle: LLM-Agnostic Always; Wrapper-First Design
- `apps/core/src/application/ports/ILlmAdapter.ts` — the interface to implement
- `apps/core/src/infrastructure/llm/index.ts` — placeholder to replace

## Implementation Guidance

### File structure

```
apps/core/src/infrastructure/llm/
  index.ts              ← factory: createLlmAdapter(config) → ILlmAdapter
  openai.adapter.ts     ← OpenAiAdapter implements ILlmAdapter
  anthropic.adapter.ts  ← AnthropicAdapter stub (throws NotImplementedError)
  mistral.adapter.ts    ← MistralAdapter stub (throws NotImplementedError)
  null.adapter.ts       ← NullLlmAdapter for tests
```

### OpenAiAdapter

- Accepts `apiKey` and optional `defaultModel` in its constructor.
- Maps `LlmRequest` → OpenAI `chat.completions.create()` call.
- Maps response → `LlmResponse` (content, model, inputTokens, outputTokens).
- Measures `latencyMs` with `Date.now()` start/end surrounding the SDK call.
- Extracts `usage.prompt_tokens` and `usage.completion_tokens` from the response.
- Sets a request timeout (recommended: 30 seconds).
- Wraps SDK errors in a domain-friendly `LlmError` (message + provider name + optional status code).

### NullLlmAdapter

- Implements `ILlmAdapter` fully.
- Returns a deterministic `LlmResponse` with configurable content (defaults to `"null adapter response"`).
- Records fake but realistic token counts and a fixed latencyMs.
- Never makes any network call.
- Used in all unit tests that depend on an LLM adapter.

### Factory function `createLlmAdapter`

```ts
// Rough shape — implement properly
function createLlmAdapter(config: LlmConfig): ILlmAdapter
```

- Reads `provider` from config (e.g. `'openai'`, `'anthropic'`).
- Returns the matching adapter.
- Throws a clear startup error for unknown providers.
- `LlmConfig` should live in `infrastructure/llm/index.ts` or be derived from `Config`.

### Config integration

- `apps/core/src/config.ts` already has `LLM_PROVIDER` and `OPENAI_API_KEY` etc. in `.env.example`.
- Add `llmProvider` and `openaiApiKey` fields to `Config` (optional, validated at startup only when provider is openai).
- Keep provider credentials optional in config so the app can start without them in test environments.

### Error handling

Define a `LlmError` class (or use a simple typed object) in `infrastructure/llm/` with:

- `provider: string`
- `message: string`
- `statusCode?: number`

Do not throw raw SDK errors into the application layer.

## Constraints

- No provider SDK import in `application/` or `domain/` — ever.
- The adapter must be fully swappable: the factory is the only coupling point.
- TypeScript strict mode: all types explicit, no `any`.
- `max-lines-per-function` ≤ 50 — keep the adapter methods small.
- Keep timeout and retry logic inside the adapter, not in calling code.

## Deliverables

- `apps/core/src/infrastructure/llm/openai.adapter.ts` — working OpenAI implementation
- `apps/core/src/infrastructure/llm/null.adapter.ts` — test double
- `apps/core/src/infrastructure/llm/anthropic.adapter.ts` — stub (not implemented)
- `apps/core/src/infrastructure/llm/mistral.adapter.ts` — stub (not implemented)
- `apps/core/src/infrastructure/llm/index.ts` — factory replacing the placeholder
- Updated `apps/core/src/config.ts` with LLM provider config fields
- Updated `.env.example` if new env vars are introduced
- Unit tests for `OpenAiAdapter` using mocked SDK and for `NullLlmAdapter`
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (required — mark EPIC 1.2 prompt 01 done)
- `docs/TECH_STACK.md` if validation notes changed
- `docs/ARCHITECTURE.md` if the infrastructure module structure expanded

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- `OpenAiAdapter` makes a real call when an `OPENAI_API_KEY` is present and returns a valid `LlmResponse`.
- `NullLlmAdapter` returns a deterministic response and never touches the network.
- Factory throws a descriptive error for unknown providers at startup, not at call time.
- All provider SDK imports are confined to `infrastructure/llm/`.
- Unit tests pass without an API key or network access.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass.
- No `any` types introduced.
