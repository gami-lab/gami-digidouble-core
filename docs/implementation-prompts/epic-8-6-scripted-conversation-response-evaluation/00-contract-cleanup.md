# Contract Cleanup Before Evaluation Tooling

## Context

The evaluation tool crosses the existing Session, Conversation, Message, model-selection, and
observability boundaries without becoming part of the Core runtime. The repository already has
shared response DTOs, route mappers, internal execution types, and optional metrics fields. The
first implementation slice must prevent the tool from copying those shapes or treating an absent
cost value as zero.

The current public conversation response exposes Avatar model, latency, and token counts. The
current raw exchange response exposes model, latency, and token counts. Neither current route
guarantees an end-to-end `costUsd` value. This remains a contract fact at the API boundary; the
evaluator may add a separately labeled, manually maintained public-price estimate but must never
present that estimate as provider-reported `costUsd`.

## Scope

In scope:

- audit the canonical owners and wire shapes for `ApiResponse`, `SendMessageResponse`,
  `MessageMetadata`, `AvatarSummary`, `ScenarioSummary`, and the raw `/v1/exchange` response;
- inspect `apps/core/src/api/routes/conversations.ts`, `apps/core/src/api/routes/exchange.ts`,
  `apps/core/src/application/ports/ILlmAdapter.ts`, `IObservabilityAdapter.ts`, and existing
  console/client type declarations for duplicated or drifting metrics shapes;
- remove or consolidate any duplication introduced or exposed by this EPIC before the evaluator
  consumes the contracts;
- establish the evaluator's own canonical internal types for a test definition, question result,
  judge result, and run report without putting evaluation-only DTOs in the Core domain;
- make cost semantics explicit: `number` when present, `null` when absent, with any evaluator price
  estimate represented in a separate field;
- if the raw exchange response has no shared wire-type owner and the tool needs one, add the
  smallest additive shared type and use it from the route/tests rather than importing Core
  internals into the tool.

Out of scope:

- Langfuse scraping;
- new HTTP endpoints;
- evaluation UI, dashboards, CI automation, or historical persistence;
- behavior changes to Session, Conversation, Memory, Game Master, or Avatar runtime logic.

## Relevant Docs

- `docs/VISION.md` — measurable, API-first, product-agnostic Core direction
- `docs/PRINCIPLES.md` — KISS, LLM agnosticism, observability, and learning speed
- `docs/ARCHITECTURE.md` — Core layers and the boundary between Core and tools
- `docs/TECH_STACK.md` — TypeScript, pnpm, provider abstraction, and test tiers
- `docs/DATA_MODEL.md` — Message metadata and event-log ownership
- `docs/API_CONTRACT.md` — current route envelopes and model-resolution precedence
- `docs/MEMORY_SYSTEM_SPEC.md` — bounded conversation context assumptions
- `docs/TEST_STRATEGY.md` — contract and deterministic-test rules
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md` — canonical shared DTO ownership
- `docs/EPICS.md` — EPIC 8.6 scope
- `docs/PROJECT_STATUS.md` — current shipped behavior

## Implementation Guidance

- Start with a repository-wide search for `MessageMetadata`, `AvatarMessageMetadata`, `SendMessageResponse`,
  `SendRawMessageOutput`, `inputTokens`, `outputTokens`, `totalTokens`, `costUsd`, `model`, and
  `latencyMs`.
- Treat `packages/shared/src/` as the owner of HTTP DTOs crossing into the new workspace. Treat
  `apps/core/src/application/` as the owner of internal execution contracts. Keep evaluation
  report types inside the evaluation package because they are tool output, not Core API state.
- Prefer the existing `ApiResponse<T>` decoder and shared DTOs. Do not re-declare the full Avatar,
  Scenario, Session, Conversation, or Message response shapes in the evaluator.
- If a shared raw-exchange output type is required, preserve the current JSON shape and update the
  existing route tests and API documentation only as needed. Do not turn this cleanup into a new
  API feature.
- Normalize optionality at the tool boundary: missing API cost becomes `null`; a missing required
  model, response, or token field is a contract error; no fallback silently fabricates values.
- Keep the refactor behavior-neutral and run the existing shared/Core tests before handing off to
  prompt 01.

## Constraints

- Respect `API → Application → Domain → Infrastructure`; the evaluator is a client/tool boundary,
  not a new Core domain module.
- Do not import provider SDKs or call them from the evaluator.
- Do not add a parallel copy of an existing shared HTTP contract.
- Do not add a new endpoint. If an existing endpoint's response type changes, update its existing
  `*.stack-e2e.test.ts` file; the endpoint change remains additive and documented.
- Keep the smallest useful change. Do not refactor unrelated legacy types.

## Deliverables

- Canonical ownership decisions applied to any touched HTTP/metrics contracts.
- No new evaluator-side copies of Avatar, Scenario, Session, Conversation, or Message DTOs.
- Explicit nullable-cost semantics and tests for absent cost.
- Any required shared raw-exchange type exported and consumed consistently.
- Passing typecheck, lint, formatting, and relevant existing tests.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: Avatar, Scenario, Session, Conversation, Message,
   model selection, raw exchange, and metrics metadata.
2. Search for duplicated type definitions, repeated inline response shapes, local copies in
   console/client code, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before feature work proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md` if ownership changed
- `docs/API_CONTRACT.md` if a shared wire type or documented response shape changed
- `docs/ARCHITECTURE.md` if the Core/tool boundary needs clarification
- `docs/DATA_MODEL.md` only if persisted metadata semantics changed
- `docs/TEST_STRATEGY.md` or `docs/TEST_COVERAGE_PLAN.md` if test ownership changed
- `docs/EPICS.md` only if the delivered scope or status changed

If no additional documentation changes are needed, explicitly verify that every impacted document
is still accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] The evaluator has a documented canonical owner for every consumed HTTP contract.
- [ ] Existing shared DTOs are reused instead of copied.
- [ ] Any blocking metrics-shape duplication is removed before runner implementation.
- [ ] Missing `costUsd` is represented as unavailable/null, never zero or an estimate.
- [ ] No provider SDK or new HTTP endpoint is introduced.
- [ ] Existing route and shared-contract tests remain green.
- [ ] Documentation accuracy is explicitly verified.
