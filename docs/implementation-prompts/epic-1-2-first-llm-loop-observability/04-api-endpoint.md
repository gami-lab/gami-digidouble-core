# Expose the Exchange via API Endpoint

## Context

The `SendRawMessageUseCase` (Prompt 03) exists and is tested in isolation. This prompt wires it into the Fastify API layer, making the first LLM loop reachable over HTTP.

This endpoint is intentionally minimal — it demonstrates the full system path from HTTP request to LLM response with metrics. It is not the final conversation API (that comes in EPIC 3.2), but it must respect the existing `ApiResponse<T>` envelope contract and API key authentication from day one.

## Scope

What must be implemented now:

- `POST /v1/exchange` route handler in the API layer.
- Request body validation (Fastify schema).
- API key authentication — validate `x-api-key` header against `config.apiKeySecret`.
- Instantiate `SendRawMessageUseCase` with the concrete adapters from the infrastructure layer.
- Map use case output to `ApiResponse<T>` using `ok()` / `fail()` from `@gami/shared`.
- Error mapping: LLM errors → appropriate HTTP status code + `ApiError` envelope.
- Integration test: inject a request via Fastify `inject()` using `NullLlmAdapter`.

What is out of scope:

- Session context or history — EPIC 3.2.
- Streaming endpoint — EPIC 3.3.
- Full OpenAPI docs / schema export — EPIC 3.2.
- Rate limiting — not in scope for Phase A.
- JWT or OAuth authentication — Phase B.

## Relevant Docs

- `docs/API_CONTRACT.md` — `ApiResponse<T>` envelope, error codes, auth header convention
- `docs/ARCHITECTURE.md` — API layer responsibilities; must not contain orchestration logic
- `docs/PRINCIPLES.md` — Validate at system boundaries; API key auth for Phase A
- `apps/core/src/api/routes/health.ts` — existing route pattern to follow
- `packages/shared/src/api-response.ts` — `ok()`, `fail()`, `ErrorCode`

## Implementation Guidance

### Route file

```
apps/core/src/api/routes/
  exchange.ts
  exchange.test.ts
```

Register the route as a Fastify plugin, consistent with the existing `health.ts` pattern.

### Request / Response shape

```
POST /v1/exchange
Header: x-api-key: <secret>

Body:
{
  "message": "Hello, who are you?",
  "systemPrompt": "You are a pirate."   // optional
}

200 Response:
{
  "data": {
    "requestId": "uuid",
    "reply": "Arrr, I be a language model...",
    "model": "gpt-4o-mini",
    "inputTokens": 12,
    "outputTokens": 34,
    "latencyMs": 420
  },
  "error": null
}
```

### Fastify schema

Define a JSON schema for the request body:

- `message`: required string, minLength 1, maxLength 4000.
- `systemPrompt`: optional string, maxLength 2000.

Use Fastify's built-in schema validation — do not hand-validate the body.

### Authentication

Add a reusable `authenticateApiKey` hook (a Fastify `preHandler`) that:

- Reads `request.headers['x-api-key']`.
- Compares it to `config.apiKeySecret` using a constant-time comparison (use `crypto.timingSafeEqual` to prevent timing attacks).
- Returns `401 Unauthorized` with a `fail(ErrorCode.UNAUTHORIZED, 'Invalid API key')` envelope if the key is missing or wrong.

Place this hook in `api/hooks/authenticate.ts` so it can be reused by all future routes.

### Use case instantiation

The route handler is responsible for instantiating the use case with the concrete adapters. For this EPIC, instantiate them directly from configuration:

```ts
const llmAdapter = createLlmAdapter(config)
const obsAdapter = createObservabilityAdapter(config)
const useCase = new SendRawMessageUseCase(llmAdapter, obsAdapter)
```

This is acceptable for now. A DI container or application-level singletons can be introduced later when there are multiple endpoints sharing the same adapters.

### Error mapping

| Error type                  | HTTP status | ErrorCode                |
| --------------------------- | ----------- | ------------------------ |
| `LlmError` (provider error) | 502         | `EXTERNAL_SERVICE_ERROR` |
| Validation error (Fastify)  | 400         | `VALIDATION_ERROR`       |
| Unauthenticated             | 401         | `UNAUTHORIZED`           |
| Unknown error               | 500         | `INTERNAL_ERROR`         |

Add `EXTERNAL_SERVICE_ERROR` to `ErrorCode` in `packages/shared` if not already present.

### Integration test

- Use Fastify `inject()` — no real HTTP server or network.
- Inject a `NullLlmAdapter` and `NullObservabilityAdapter` so tests never need a real API key or LLM.
- Test: valid request with correct API key → 200 with `ApiResponse<ExchangeOutput>`.
- Test: missing API key → 401 with error envelope.
- Test: wrong API key → 401 with error envelope.
- Test: missing `message` field → 400 with validation error.

To inject test adapters, create the Fastify server with an optional adapters override in `createServer()`, or accept them as parameters in a test factory function. Do not tightly couple the route to the adapter factory.

## Constraints

- API layer must not perform business logic — thin handler, delegate to use case.
- Use `crypto.timingSafeEqual` for API key comparison — no plain `===`.
- Fastify schema validation must reject invalid bodies before the handler runs.
- `ApiResponse<T>` envelope on all responses — never raw objects.
- TypeScript strict mode — no `any`.
- `max-lines-per-function` ≤ 50.

## Deliverables

- `apps/core/src/api/routes/exchange.ts` — route plugin
- `apps/core/src/api/routes/exchange.test.ts` — integration tests
- `apps/core/src/api/hooks/authenticate.ts` — reusable auth preHandler
- Updated `packages/shared/src/api-response.ts` if new `ErrorCode` values needed
- Route registered in `apps/core/src/api/server.ts`
- All tests pass
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (required — mark EPIC 1.2 prompt 04 done)
- `docs/API_CONTRACT.md` — add `POST /v1/exchange` endpoint contract

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- `POST /v1/exchange` with valid API key and body returns 200 with correct `ApiResponse<T>` shape.
- Missing or wrong API key returns 401 — tested.
- Invalid body returns 400 — tested.
- Authentication uses constant-time comparison.
- No LLM API call is made during tests (adapters are injected as test doubles).
- `POST /v1/exchange` is documented in `docs/API_CONTRACT.md`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass.
