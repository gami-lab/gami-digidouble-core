# Code Audit — EPIC 5.3 Streaming UX Layer

## Scope audited

This audit covers the implementation described by `docs/implementation-prompts/epic-5-3-streaming-ux-layer/README.md` and its ordered slices `00` through `05`.

The review included:

- `apps/core` streaming contracts, application flow, API route, LLM adapters, observability wrapper, and tests.
- `packages/shared` public stream DTOs and SSE frame helpers.
- `apps/web` message-stream API client, progressive draft state, cleanup, and behavior tests.
- The mandated project documents: `VISION.md`, `PRINCIPLES.md`, `ARCHITECTURE.md`, `TECH_STACK.md`, `DATA_MODEL.md`, `API_CONTRACT.md`, `TEST_STRATEGY.md`, `TEST_COVERAGE_PLAN.md`, `EPICS.md`, and `PROJECT_STATUS.md`.

## Executive Summary

EPIC 5.3 is functionally delivered as an additive SSE transport. The implementation preserves the synchronous JSON message endpoint, defines shared public stream events, extends the internal LLM port, reuses the synchronous send-message preparation/completion mechanics, persists only successful avatar replies, keeps GM/memory work asynchronous, and renders progressive output in the public web app.

The architecture is sound: provider SDKs remain in infrastructure, application code is transport-agnostic, and public DTO ownership is in `@gami/shared`. The test suite is substantial and all mandatory local checks pass.

The main residual risk is interruption behavior at the actual HTTP connection boundary. Unit tests prove provider/application iterator cleanup and the web reader cancellation path, but there is no route-level integration test that closes a live response and proves the raw request close event aborts the provider, closes the iterator, avoids partial avatar persistence, and suppresses post-turn work. The web client also casts parsed JSON directly to `MessageStreamEvent` without runtime validation. These are meaningful hardening gaps, not evidence that the normal completion path is broken.

## Final Grade

**B — solid implementation with meaningful hardening debt.**

The EPIC is safe to close with debt, but not an A-grade foundation until the end-to-end disconnect path and stream payload validation are proven.

## Build Health

- lint: **PASS** — `pnpm lint` completed successfully.
- typecheck: **PASS** — `pnpm typecheck` completed successfully.
- tests: **PASS** — `pnpm test` completed successfully: 137 core test files / 810 core tests, plus passing shared, web, console, and admin suites.
- coverage: **PASS** — `pnpm test:coverage` completed successfully. Core aggregate: 87.05% statements, 84.69% branches, 96.21% functions, 87.05% lines. Stream-specific files: `streaming-send-message.use-case.ts` 82.27% lines; `conversations.ts` 92.48% lines.

Additional check: `pnpm test:stack-e2e` was attempted and could not execute because the configured live app at `http://localhost:3000` was unavailable. The required `conversation-message-stream.stack-e2e.test.ts` file exists and statically covers auth, validation, not-found, and happy-path cases, but this workspace run provides no live-stack evidence.

## Feature Confidence Matrix

| Feature                       | Expected Behavior                                                                                                               | Evidence                                                                                                                    | Confidence (High/Medium/Low) | Notes                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical contracts           | One shared public request/event ownership model with no new cross-app stream DTO duplication                                    | `packages/shared/src/conversation-stream-contract-types.ts`, shared exports, `SendMessageRequest` reuse, web client imports | High                         | Internal application events remain separate and are mapped at the API boundary as intended.                                           |
| LLM streaming port            | Ordered deltas, one terminal response with metadata, cancellation signal, existing `complete` compatibility                     | `ILlmAdapter`, OpenAI/Anthropic/Mistral/xAI/null/observed adapters, adapter unit tests                                      | High                         | Happy streaming and signal forwarding are covered; provider abort during a live SDK iteration is not fully proven for every adapter.  |
| Streaming send-message flow   | Persist user first; stream ordered deltas; persist avatar only after successful completion; schedule GM/memory after completion | `StreamingSendMessageUseCase`, send-message tests, route happy-path history assertion                                       | High                         | Normal completion, provider abort, client abort, exact-once terminal persistence, and GM suppression are tested at application level. |
| Interruption at HTTP boundary | Disconnect aborts work, cleans up listeners/iterators, leaves user message, and avoids partial avatar/GM work                   | Application interruption tests, web reader-cancel test, route `close` handler                                               | Medium                       | No live route test proves the complete connection-close-to-provider-cleanup chain.                                                    |
| Public SSE endpoint           | Additive POST route with headers, framing, auth, validation, not-found, ordered events, one completion payload                  | In-process route tests and required stack-e2e file                                                                          | Medium                       | In-process tests pass; live stack-e2e was blocked by unavailable app.                                                                 |
| Progressive web chat          | Optimistic user message, contiguous delta rendering, terminal reconciliation, cleanup on interruption/error                     | `message-stream-runtime.ts`, API client tests, `use-active-chat-runtime.behavior.test.tsx`                                  | High                         | Out-of-order/duplicate delta behavior and reader cleanup are covered. Runtime payload validation is absent.                           |
| Backward compatibility        | Existing JSON endpoint and response envelope remain stable                                                                      | Legacy JSON route contract test and full regression suite                                                                   | High                         | No breaking route/schema change observed.                                                                                             |
| Documentation closure         | Impacted contracts, architecture, testing, status, and EPIC ledger reflect shipped behavior                                     | `API_CONTRACT.md`, `ARCHITECTURE.md`, `TECH_STACK.md`, `DATA_MODEL.md`, `TEST_*`, `EPICS.md`, `PROJECT_STATUS.md`           | High                         | `EPICS.md` and `PROJECT_STATUS.md` mark 5.3 complete consistently.                                                                    |

## Strengths

- The route is additive and reuses the existing `SendMessageRequest`; the synchronous JSON endpoint remains covered.
- Public stream DTOs are owned by `@gami/shared`; internal provider events are owned by `ILlmAdapter` and do not leak SDK types into application code.
- `StreamingSendMessageUseCase` reuses `SendMessageUseCase.prepareTurn` and `completeTurn` rather than cloning prompt, memory, model-resolution, persistence, and observability behavior.
- Persistence boundaries match the documented data model: user message before streaming, no partial avatar message, final avatar only after terminal completion.
- GM and memory work are scheduled after successful completion, preserving the Avatar-first/non-blocking invariant.
- The web client has deliberate contiguous sequence handling, duplicate/stale delta suppression, response reader cancellation, abort-listener removal, and terminal reconciliation.
- The observed adapter traces a stream once at terminal completion rather than creating one trace per delta.
- No provider SDK imports were found outside `apps/core/src/infrastructure/llm`.
- The impacted API, architecture, technology, data-model, testing, roadmap, and status documentation is aligned with the implementation.

## Findings

### HTTP disconnect cleanup is not proven at the route boundary

- Severity: Medium
- Category: Test quality / operational correctness
- Problem: The route attaches an abort controller to `request.raw` `close` and calls `iterator.return()` in `finally`, but no route-level test simulates a client disconnect while the provider iterator is pending.
- Why it matters: The most failure-sensitive promise of streaming is cleanup under disconnect. A regression in Fastify/Node event wiring could leave an upstream provider request running, leave listeners attached, or schedule work unexpectedly while all current unit tests remain green.
- Evidence: `apps/core/src/api/routes/conversations.ts:158-218` contains the connection lifecycle; application tests prove iterator cleanup and persistence rules, but `conversations.test.ts` only covers normal framing and application-level interruption.
- Recommendation: Add an HTTP integration test with a blocking fake stream and a real server response/socket close. Assert abort propagation, provider iterator close, one persisted user message, zero persisted avatar messages, no GM/memory scheduling, and deterministic response cleanup.

### Client stream payloads are trusted without runtime validation

- Severity: Medium
- Category: Contract safety / maintainability
- Problem: `processSseFrames` deliberately returns `unknown`, but `apps/web/src/api/conversations.ts` casts each decoded value directly to `MessageStreamEvent`.
- Why it matters: A malformed, stale, or incompatible server frame can reach the UI as if it were valid. This can silently fail terminal detection or produce invalid state updates, making deployment skew and protocol regressions harder to diagnose.
- Evidence: `apps/web/src/api/conversations.ts:147-151` uses `event as MessageStreamEvent`; the shared parser only validates JSON syntax, not event shape.
- Recommendation: Add a small shared type guard/decoder for `MessageStreamEvent`, reject malformed frames with a bounded client error, and test unknown event types, missing identifiers, invalid delta sequence, and malformed completion payloads.

### Stream interruption has no explicit observability contract

- Severity: Medium
- Category: Observability / supportability
- Problem: `LlmStreamEvent` contains only `delta` and `completed`; the observed adapter traces successful completion or generic failure, but there is no explicit cancellation/interruption event or metric dimension for client/provider aborts.
- Why it matters: Operators cannot reliably distinguish user cancellation, network disconnect, provider failure, and server failure from the stream trace surface. This weakens latency, abandonment, and provider-cost diagnosis.
- Evidence: `apps/core/src/application/ports/ILlmAdapter.ts:33-51` has no interruption event; `apps/core/src/infrastructure/llm/observed.adapter.ts:31-57` records terminal success or failure only.
- Recommendation: Add a bounded interruption outcome to the existing observability event metadata or trace contract, including reason, elapsed time, request/session/conversation identifiers, and whether final persistence occurred. Keep it on the existing single trace boundary.

### Concrete provider abort cleanup is under-tested

- Severity: Medium
- Category: Test quality / infrastructure resilience
- Problem: Provider tests primarily assert happy-path deltas, terminal usage, and signal forwarding. They do not consistently simulate abort during iteration and verify the underlying SDK stream is closed or that no terminal event is emitted.
- Why it matters: SDK cancellation behavior is vendor-specific and is exactly where the replaceable-infrastructure boundary can fail without affecting deterministic unit tests.
- Evidence: OpenAI, Anthropic, Mistral, and xAI stream tests cover normal iteration; cancellation assertions are strongest in the null adapter and application-level fake iterator tests.
- Recommendation: Add one focused cancellation test per adapter or a shared adapter harness using fake SDK iterators. Assert signal propagation, iterator closure, error classification, and absence of terminal completion after abort.

### Domain and public message metadata contracts still require manual synchronization

- Severity: Low
- Category: Structural maintainability / contract ownership
- Problem: `Message` and `MessageMetadata` are structurally duplicated between `apps/core/src/domain/conversation/session.types.ts` and `packages/shared/src/conversation-contract-types.ts`. The route also manually maps the internal `SendMessageOutput` into the public `SendMessageResponse`.
- Why it matters: This is a justified domain/public boundary, not an architecture violation, but a future message or metadata field can require coordinated edits in domain types, shared DTOs, persistence builders, output builders, and route mapping. Drift can compile successfully when fields remain optional.
- Evidence: The two message contracts have the same current fields; `mapSendMessageResponse` in `apps/core/src/api/routes/conversations.ts:392-448` duplicates response shaping.
- Recommendation: Preserve the domain/public separation, but make ownership explicit in one mapper module and add a consumer-contract test that enumerates required fields. Avoid broad code generation or a shared domain type solely to remove a small, intentional boundary.

## Architecture Review

The implementation respects the modular-monolith boundaries:

- API: Fastify owns auth, schema validation, SSE headers/framing, request lifecycle, and mapping to public DTOs.
- Application: `StreamingSendMessageUseCase` owns turn orchestration and yields transport-neutral internal events.
- Domain: conversation/message lifecycle types and existing prompt/context rules remain free of Fastify and provider SDK concerns.
- Infrastructure: concrete provider SDK calls remain under `infrastructure/llm`; observability remains behind `IObservabilityAdapter`.
- Shared: `MessageStreamEvent`, existing message/response contracts, and generic SSE frame processing are reusable public contracts/utilities.

The route does contain non-trivial lifecycle code, but it is transport-specific rather than business logic. The application use case correctly keeps background GM/memory work after final persistence. No general event bus, WebSocket path, or vendor leakage was introduced.

The main maintainability concern is contract mapping breadth, not architectural drift. Internal and public `Message` contracts are intentionally separate, but their parallel evolution needs explicit review when fields change.

## Test Review

### Strong tests

- `send-message.use-case.test.ts` proves user-first persistence, ordered deltas, final content accumulation, exact-once avatar persistence, provider interruption, client interruption, and post-turn scheduling order.
- `conversations.test.ts` proves additive route behavior, SSE content type/framing, ordered events, canonical completion payload, persisted history, auth, validation, not-found, and legacy JSON compatibility.
- `conversation-message-stream.stack-e2e.test.ts` exists with the required auth, validation, not-found, and happy-path cases and uses real HTTP APIs when the stack is available.
- `apps/web/src/api/conversations.test.ts` proves chunk-boundary parsing, terminal detection, incomplete-stream failure, and response-reader cancellation.
- `use-active-chat-runtime.behavior.test.tsx` proves optimistic sends, duplicate/out-of-order delta handling, progressive drafts, completion reconciliation, send failure, and interruption cleanup.
- Adapter and observed-adapter tests assert the downstream SDK/observability boundary fields rather than only mock invocation counts.

### Weak or missing tests

- No route-level live disconnect test proves raw request close, abort propagation, iterator closure, and persistence/GM invariants together.
- No live stack-e2e execution was possible in this environment; CI/nightly execution remains the source of truth for that tier.
- Provider interruption/resource closure is not consistently tested across all concrete adapters.
- No negative client-contract tests prove malformed or schema-invalid JSON frames are rejected before state mutation.
- No explicit stream interruption observability assertion proves operator-visible cancellation reason and timing.

### Implementation-coupled tests

No material private-internal or snapshot abuse was found in the stream tests. Assertions on provider request shape and observability calls are appropriate boundary tests because those are the actual consumers. The main confidence limitation is missing boundary scenarios, not excessive implementation mirroring.

## Documentation Gaps

The impacted documentation is substantially complete and consistent:

- `API_CONTRACT.md` documents the additive route, shared ownership, event ordering, and interruption persistence semantics.
- `ARCHITECTURE.md` documents layer placement, adapter boundaries, cleanup, and the route flow.
- `TECH_STACK.md` documents SSE and progressive message behavior.
- `DATA_MODEL.md` records that streaming is transport-only and partial avatar messages are not persisted.
- `TEST_STRATEGY.md` and `TEST_COVERAGE_PLAN.md` include stream ordering, interruption, cleanup, and contract expectations.
- `EPICS.md` and `PROJECT_STATUS.md` mark EPIC 5.3 complete and describe the shipped hardening.

No VISION or PRINCIPLES change is required; the EPIC implements existing Avatar-first, additive-contract, replaceable-infrastructure, and observability principles rather than changing them. The documentation should be amended only if the recommended interruption observability contract is added.

## Path to A

Minimal steps:

1. Add a route-level disconnect test that proves the complete abort-to-cleanup-to-persistence boundary over HTTP.
2. Add runtime validation for public stream frames and negative client tests for malformed payloads.
3. Add explicit interruption observability metadata/outcomes and tests for client/provider cancellation.
4. Add concrete provider abort/iterator cleanup tests for each supported SDK adapter.
5. Clarify the domain/public message contract mapper ownership and protect required response fields with a consumer-facing contract test.

## Final Recommendation

- Close EPIC now
- Close with debt
- Rework before close

**Recommendation: Close with debt.** The normal shipped path is complete, backward-compatible, and well-tested. Track the five hardening items above before treating streaming interruption and operational diagnostics as an A-grade release foundation.

## Remediation Outcome

### Changes Made

- Added a shared runtime decoder for `MessageStreamEvent` and made the web client reject malformed frames before consumer state mutation.
- Added shared contract tests for valid and invalid stream events, including canonical completion payloads and sequence validation.
- Added a Fastify route-boundary disconnect test proving interruption delivery, provider cancellation, iterator cleanup, and user-only persistence.
- Added explicit client/provider interruption outcomes and reasons to the existing observed LLM trace boundary, with tests proving single-trace behavior.
- Added preflight abort checks to every concrete streaming provider adapter so an already-cancelled request never starts provider work.
- Updated API, architecture, technology, testing, and project-status documentation to describe the hardened behavior and contract ownership.

### Findings Resolved

- HTTP disconnect cleanup is now proven at the route boundary, including abort propagation, iterator closure, no completed event, and no partial avatar persistence.
- Public stream frames are runtime-validated through the shared decoder; malformed payloads are rejected before reaching the web consumer.
- Stream interruption now has explicit, bounded observability metadata: `outcome: interrupted`, reason, latency, and the existing request/session trace context.
- OpenAI, Anthropic, Mistral, and xAI adapters now reject already-cancelled requests before invoking their provider SDKs, with focused tests for each adapter.
- Contract ownership is clearer: the shared package owns public stream decoding, while domain-to-public mapping remains an intentional API boundary protected by contract tests. No new parallel DTO family was introduced.

### Findings Deferred

- No material EPIC finding is deferred. The domain/public message contract split remains intentionally separate; future field additions still require mapper and contract review, which is a low residual risk rather than an EPIC blocker.
- Live stack E2E execution still depends on the Docker-backed environment and was not available during this local audit; the route boundary is covered with an in-process Fastify integration test and the stack suite remains present for CI/nightly execution.

### Build Gates

- lint: PASS
- typecheck: PASS
- tests: PASS — 181 test files, 992 tests
- coverage: PASS — core coverage: 87.18% statements, 84.69% branches, 96.43% functions, 87.18% lines

### Final Feature Confidence

- Shared stream contract decoding: High — valid, malformed, unknown-type, sequence, and completion-shape behavior is directly tested.
- Core streaming use case: High — observable ordering, persistence, interruption, and post-turn behavior are covered.
- HTTP SSE route: High — success, compatibility, validation, auth, not-found, and disconnect behavior are covered at the Fastify boundary.
- Provider cancellation: High — all four concrete provider adapters prove preflight cancellation and the observed adapter proves client/provider interruption classification.
- Web stream consumption: High — chunk boundaries, malformed frames, incomplete terminal streams, cancellation, and consumer callbacks are covered.
- Documentation and public contract alignment: High — impacted architecture, API, stack, testing, and status documents were synchronized.

### Final Grade

**A**

### Remaining Risks

- Live Docker stack E2E should run in CI/nightly to verify the deployed process boundary and provider wiring in an environment with the full stack available.
- Domain and public message contracts remain separate by design; mapper-focused tests are the guard against future field drift.
