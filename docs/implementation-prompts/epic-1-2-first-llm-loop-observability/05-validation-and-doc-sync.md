# Validate EPIC 1.2 End-to-End and Synchronize Documentation

## Context

Final EPIC 1.2 closure requires proving the full LLM loop works and that all documentation reflects the implemented architecture. This prompt covers end-to-end validation, small friction fixes, and documentation synchronization.

## Scope

What must be done now:

- Validate the complete flow end-to-end: HTTP request → use case → LLM adapter → observability → response.
- Confirm metrics are captured (latency, tokens, model name) on every call.
- Validate startup and graceful shutdown (observability flush).
- Check for and remove any leftover stubs or dead code from Prompts 01–04.
- Synchronize all impacted documentation.
- Mark EPIC 1.2 complete in `docs/PROJECT_STATUS.md`.

What is out of scope:

- Any EPIC 2.x features (Avatar, GM, sessions).
- Streaming.
- Performance benchmarking — that is EPIC 2.3.

## Relevant Docs

- `docs/PROJECT_STATUS.md` (mandatory update)
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

## Implementation Guidance

### Validation checklist

Execute the following locally:

1. **Clean install**: `rm -rf node_modules apps/core/node_modules packages/shared/node_modules && pnpm install`
2. **Quality gates**: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
3. **All tests pass** — including the new use-case unit tests and API integration tests.
4. **Live smoke test** (requires a real `OPENAI_API_KEY` in `.env`):
   - Start infra: `pnpm infra:up`
   - Start app: `pnpm dev`
   - Send a request:
     ```bash
     curl -s -X POST http://localhost:3000/v1/exchange \
       -H "Content-Type: application/json" \
       -H "x-api-key: <your API_KEY_SECRET>" \
       -d '{"message": "Say hello in one sentence."}'
     ```
   - Assert: 200 response, non-empty `reply`, non-zero `inputTokens` and `outputTokens`.
5. **Observability verification**: confirm a trace appears in Langfuse (if running) or in stdout (console adapter).
6. **Graceful shutdown**: stop the app with `Ctrl+C` — confirm no hanging process and no error about unflushed traces.

### Friction / hardening to check

- Verify that `LlmError` produces a meaningful error message visible in the API response (not a raw SDK stack trace).
- Verify that a request sent without `OPENAI_API_KEY` configured (but with the app running) returns a 502 with a clean `EXTERNAL_SERVICE_ERROR` response, not a 500 crash.
- Verify that `NullLlmAdapter` and `NullObservabilityAdapter` are not used in the production code path.
- Verify the `authenticate.ts` hook is applied to `/v1/exchange` but not to `/health`.

### Documentation audit

For each document below, check whether the implementation drifted from what is written:

- `docs/API_CONTRACT.md` — `POST /v1/exchange` must be documented with request schema, response schema, and error codes.
- `docs/ARCHITECTURE.md` — "Suggested Code Structure" / module map should reflect the new `use-cases/` folder under `application/`, `hooks/` under `api/`, and filled `infrastructure/llm/` and `infrastructure/observability/`.
- `docs/TECH_STACK.md` — Sections 6 (LLM Layer) and 12 (Observability) should reflect the final provider and Langfuse setup. Note the current OpenAI adapter as the first real provider.
- `docs/TEST_STRATEGY.md` — Verify the test strategy reflects that use-case tests use `NullLlmAdapter` and `NullObservabilityAdapter` (not live calls).
- `README.md` — No changes needed unless new setup steps are required (e.g. `OPENAI_API_KEY`).

## Constraints

- No feature additions during this validation step.
- KISS — fix only what is broken or inconsistent.
- Every doc update must reflect reality, not aspiration.

## Deliverables

- Confirmed end-to-end flow (real LLM call if API key available, otherwise smoke test log evidence).
- Any small friction fixes found during validation applied.
- `docs/API_CONTRACT.md` updated with the `POST /v1/exchange` endpoint.
- `docs/ARCHITECTURE.md` updated to reflect use-cases structure and filled infrastructure modules.
- `docs/PROJECT_STATUS.md` updated: EPIC 1.2 marked **Complete**.
- All quality gates pass.

## Mandatory Final Step — Documentation Update

After validation, review and update:

- `docs/PROJECT_STATUS.md` (required)
- `docs/API_CONTRACT.md` (required — new endpoint)
- `docs/ARCHITECTURE.md` (required — new folders)
- `docs/TECH_STACK.md` if observability or LLM provider notes changed
- `docs/TEST_STRATEGY.md` if test adapter patterns are worth documenting explicitly

## Acceptance Criteria

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass after clean install.
- `POST /v1/exchange` with a real API key returns a live LLM response (verified manually).
- Observability trace captured on each call (console or Langfuse).
- `EPIC 1.2` status in `docs/PROJECT_STATUS.md` is **Complete** with a summary of what was built.
- `POST /v1/exchange` contract is documented in `docs/API_CONTRACT.md`.
- No known documentation drift remains.
- Graceful shutdown flushes observability without errors.
