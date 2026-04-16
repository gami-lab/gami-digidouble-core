# EPIC Prompt Pack — EPIC 1.2 First LLM Loop + Observability

## EPIC Name

EPIC 1.2 — First LLM Loop + Observability

## Objective

Validate end-to-end AI interaction immediately by wiring the first LLM provider adapter, implementing the observability wrapper, connecting them through a minimal use case, and exposing the loop through a working API endpoint with captured metrics on every call.

## Generated Date

2026-04-16

## Prompt Files

1. `01-llm-provider-adapter.md`
2. `02-observability-adapter.md`
3. `03-first-exchange-use-case.md`
4. `04-api-endpoint.md`
5. `05-validation-and-doc-sync.md`

## Dependencies Between Prompts

- Prompt 01 is independent — it only touches `infrastructure/llm/` and the port interface.
- Prompt 02 is independent — it only touches `infrastructure/observability/` and the port interface.
- Prompt 01 and 02 can be worked in parallel.
- Prompt 03 depends on Prompts 01 and 02 — it composes both adapters in an application use case.
- Prompt 04 depends on Prompt 03 — it exposes the use case through the Fastify API layer.
- Prompt 05 depends on all previous prompts — it validates the full loop and closes the EPIC.

## Suggested Execution Order

1. `01-llm-provider-adapter.md`
2. `02-observability-adapter.md`
3. `03-first-exchange-use-case.md`
4. `04-api-endpoint.md`
5. `05-validation-and-doc-sync.md`

## Definition of Done for Full EPIC

- `ILlmAdapter` has at least one concrete provider implementation (OpenAI minimum).
- `IObservabilityAdapter` has a concrete implementation that records latency, tokens, and cost.
- A `SendRawMessage` use case composes both adapters.
- `POST /v1/exchange` (or equivalent) accepts a message and returns a model response.
- Every LLM call captures: request ID, latency, input tokens, output tokens, model used.
- All adapters are isolated behind port interfaces — no provider SDK in domain or application code.
- Unit tests cover the use case with adapter mocks.
- Integration test covers the API endpoint.
- `docs/PROJECT_STATUS.md` updated to reflect EPIC 1.2 complete.
- All quality gates pass: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
