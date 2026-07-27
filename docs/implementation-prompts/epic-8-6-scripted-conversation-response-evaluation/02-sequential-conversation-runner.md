# Implement the Sequential Conversation Runner

## Context

The Core already exposes the lifecycle needed for a scripted run: create a session, start a
conversation for an available Avatar, and send messages through the existing JSON conversation
route. The evaluator must exercise that public flow exactly as a client would, using one session and
one conversation for the ordered question list.

The Avatar response path is intentionally low-latency and the Game Master/memory work is
asynchronous. The evaluator should wait for the response returned by each message request, then let
the platform continue its normal background work. It must not add polling or artificial sleeps that
change runtime behavior.

## Scope

In scope:

- implement a typed `fetch`-based Core API client with base-URL normalization, API-key headers,
  timeout/abort handling, JSON decoding, and standard `ApiResponse` error handling;
- create a session with `POST /v1/sessions` using the configured scenario and run-scoped user ID;
- resolve `initialAvatarId` directly or resolve a unique `initialAvatarName` through the existing
  scenario/avatar API before starting the conversation;
- start one conversation with `POST /v1/sessions/{sessionId}/conversations`;
- send each question with `POST /v1/conversations/{conversationId}/messages` only after the prior
  Avatar response has returned;
- preserve the same session ID and conversation ID on every successful question result;
- extract observed Avatar response, model, latency, input tokens, output tokens, total tokens, and
  optional cost through canonical shared DTOs;
- classify request failures and retain completed results so the report layer can persist a partial run.

Out of scope:

- streaming message execution;
- switching avatars during a scripted run;
- polling GM events or waiting for memory refresh;
- model configuration mutation;
- semantic judging and final aggregation (prompt 03);
- new HTTP endpoints or changes to Core lifecycle behavior.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md`
- `docs/implementation-prompts/epic-8-6-scripted-conversation-response-evaluation/00-contract-cleanup.md`
- `docs/implementation-prompts/epic-8-6-scripted-conversation-response-evaluation/01-tool-foundation-and-definitions.md`
- `apps/core/src/api/routes/exchange.stack-e2e.test.ts` — existing HTTP client/stack pattern

## Implementation Guidance

- Decode every response through the standard `ApiResponse<T>` envelope. Surface status, error code,
  and safe message in a typed client error; do not parse arbitrary successful JSON as if it were a
  successful Core response.
- Use `POST /v1/sessions` followed by the explicit conversation-start route. Do not assume session
  creation automatically creates a conversation.
- For name-based Avatar selection, use the existing scenario/avatar listing contract and require
  exactly one normalized name match. Never choose the first arbitrary Avatar in a multi-Avatar
  scenario.
- Implement the question loop as an awaited sequence. Record the question number and original
  question/expected text exactly as defined, along with the returned actual response and metadata.
- Treat API errors separately from quality status. If a response indicates the conversation is no
  longer usable, stop and return a partial execution; otherwise preserve the error and continue only
  when doing so is safe and defined by the client.
- Use response-provided `totalTokens` and `costUsd` when present. If total tokens are absent but the
  API contract guarantees input/output counts, derive only total tokens as their sum and document
  that derivation. Never derive cost from tokens or model names.
- Return an execution record collection and session metadata to prompt 03 rather than printing or
  writing reports from the low-level client.

## Constraints

- Use public HTTP contracts only; no direct Core imports beyond shared DTOs.
- Never import provider SDKs or call LLMs directly.
- Do not mutate model configuration. Record declared versus observed model and expose mismatches.
- Do not wait for asynchronous GM/memory work; preserve the normal API behavior.
- No new endpoint means no new stack-E2E file. If an existing route contract is changed, extend its
  existing stack-E2E file in the same EPIC with the required contract checks.
- Keep API error bodies bounded and free of API keys, prompts, or secrets.

## Deliverables

- Typed Core API client and request timeout behavior.
- Session/conversation bootstrap flow with deterministic initial-Avatar resolution.
- Sequential runner returning one ordered execution record per attempted question.
- Same-session/same-conversation identity preserved in records.
- Metadata extraction with explicit nullable cost.
- Unit tests using mocked `fetch` for ordering, request paths, auth headers, timeout, envelope
  errors, not-found bootstrap failures, and partial execution.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: Scenario, Avatar, Session, Conversation, Message,
   `ApiResponse`, `SendMessageResponse`, and metrics metadata.
2. Search for duplicated type definitions, repeated inline response shapes, local copies in
   console/client code, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse the shared HTTP DTOs and existing route semantics where possible.
5. If no canonical owner exists, create one before adding a local copy.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required
- `docs/API_CONTRACT.md` if the client reveals or requires a contract correction
- `docs/ARCHITECTURE.md` if the tool/API boundary needs clarification
- `docs/DATA_MODEL.md` if report persistence is confused with Core persistence; it should not be
- `docs/TEST_STRATEGY.md` or `docs/TEST_COVERAGE_PLAN.md` if client test guidance changes
- `docs/EPICS.md` only if the delivered status/scope changed

If no doc changes are needed, explicitly verify that the current lifecycle and contract docs remain
accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] A valid definition creates one session and one conversation through documented routes.
- [ ] The configured initial Avatar is selected deterministically.
- [ ] Questions are sent strictly in order and reuse the same conversation ID.
- [ ] Auth, envelope errors, timeouts, and not-found failures are surfaced safely.
- [ ] Avatar response text and API-provided metrics are retained per question.
- [ ] Missing cost is represented as unavailable/null and never estimated.
- [ ] Background GM/memory work is not polled or made blocking by the tool.
- [ ] Runner tests prove request order and partial-result behavior.
- [ ] Documentation accuracy is explicitly verified.
