# Code Audit — EPIC 8.2 Runtime Context Assembly Refactoring

## Scope audited

- EPIC definition: `docs/implementation-prompts/epic-8-2-runtime-context-assembly-refactoring/README.md`
- Project alignment docs:
  - `docs/VISION.md`
  - `docs/PRINCIPLES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TECH_STACK.md`
  - `docs/DATA_MODEL.md`
  - `docs/API_CONTRACT.md`
  - `docs/TEST_STRATEGY.md`
  - `docs/TEST_COVERAGE_PLAN.md`
  - `docs/EPICS.md`
  - `docs/PROJECT_STATUS.md`
- Implementation surfaces:
  - runtime context contracts and `ContextEngine`
  - avatar prompt assembly and `computedTraits` fallback
  - `SendMessageUseCase` runtime wiring
  - runtime-inspection/event projection and shared DTOs
  - unit, route, and in-process E2E tests related to the EPIC

## Executive Summary

EPIC 8.2 is functionally delivered on the main runtime path. The Avatar prompt is now assembled in the intended priority order, `computedTraits` are preferred when present, legacy avatars fall back to `personaPrompt`, token-budget trimming is deterministic, and bounded observability metadata is emitted without leaking prompt content.

Architecture quality is strong in the core path. The refactor stays inside the existing modular-monolith boundaries, the `ContextEngine` owns deterministic assembly, the Avatar module owns prompt rendering, and `SendMessageUseCase` remains the workflow coordinator instead of reintroducing ad-hoc prompt building.

This is not an A because the operator-facing inspection story is still split across two incompatible models. The runtime itself uses semantic sections, but the admin session-context contract still exposes a legacy “stable prompt inputs” view, and recorded avatar snapshots do not surface response rules or avatar traits as explicit inspectable sections. That keeps the system shippable, but it is not yet the clean, inspectable end state the EPIC language implies.

## Final Grade

B

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage`; `@gami/core` totals: 86.88% statements, 84.9% branches, 96.46% functions, 86.88% lines)

## Feature Confidence Matrix

| Feature                              | Expected Behavior                                                                                                                                                    | Evidence                                                                                                                                                                                                        | Confidence (High/Medium/Low) | Notes                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| Runtime section precedence           | Avatar runtime context is assembled in EPIC order: Director Notes, Response Rules, Conversation State, User Persona, World Context, Retrieved Context, Avatar Traits | `apps/core/src/domain/avatar/persona-prompt.service.ts`, `apps/core/src/domain/avatar/persona-prompt.service.test.ts`, `apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts:312-468` | High                         | Proven in both prompt-assembly unit tests and the normal send-message path |
| `computedTraits` runtime consumption | Prepared traits are preferred; missing or `null` traits fall back to authored `personaPrompt`                                                                        | `apps/core/src/domain/avatar/persona-prompt.service.ts:106-125`, `apps/core/src/api/routes/conversation-runtime-context.e2e.test.ts:122-183`                                                                    | High                         | Behavior is proven on the HTTP path                                        |
| Deterministic token-budget behavior  | Higher-priority sections survive small budgets and lower-priority retrieval/traits are trimmed deterministically                                                     | `apps/core/src/domain/context/context-engine.service.test.ts:143-210`                                                                                                                                           | High                         | Good deterministic coverage                                                |
| Safe turn diagnostics                | Turn-completed/session-event payloads keep bounded counts and exclude raw prompt/retrieval content                                                                   | `apps/core/src/application/services/runtime-inspector-event-context.ts`, `apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.test.ts:308-483`                                 | High                         | Strong redaction assertions                                                |
| Runtime inspection alignment         | Operator-facing inspection surfaces reflect the same semantic runtime model used by the turn path                                                                    | `apps/core/src/application/use-cases/get-session-context/get-session-context.use-case.ts:49-64`, `packages/shared/src/runtime-inspector-types.ts:387-399`                                                       | Low                          | Contract remains on the legacy “stable prompt inputs” model                |

## Strengths

- Core runtime refactor is cleanly layered. `ContextEngine` builds sections, Avatar prompt assembly renders them, and `SendMessageUseCase` wires them together without leaking infra concerns into domain code.
- The compatibility boundary is explicit and disciplined. `computedTraits` are preferred, but older avatars still work through a narrow fallback.
- Test quality is materially better than “mock-called” coverage. The strongest tests assert actual prompt content, section ordering, trimming behavior, and redacted event payloads.
- Shared DTO ownership is mostly sound on the event path. The recorded-event mapping strips unsafe content and normalizes retrieval provenance through shared types.
- Build health is strong. `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` all passed on July 20, 2026.

## Findings

### Admin session-context contract is still on the pre-EPIC runtime model

- Severity: High
- Category: Architecture / operational quality
- Problem:
  The main admin session-context route still returns `avatarPrompt`, `worldContext`, `worldObjectives`, `gmInstruction`, `workingMemory`, and `currentExchanges` instead of the semantic runtime sections introduced by EPIC 8.2. It also returns authored `personaPrompt`, not the preferred runtime identity source when `computedTraits` are present.
- Why it matters:
  The runtime path was refactored to make section precedence and trait consumption inspectable. Operators using `/v1/admin/sessions/{sessionId}/context` cannot actually inspect that runtime model, so the primary inspection surface now describes a different system than the one that generated the turn.
- Evidence:
  - `apps/core/src/application/use-cases/get-session-context/get-session-context.use-case.ts:49-64`
  - `apps/core/src/application/use-cases/get-session-context/get-session-context.types.ts:7-18`
  - `packages/shared/src/runtime-inspector-types.ts:387-399`
  - `docs/API_CONTRACT.md:944-952`
  - `apps/core/src/api/routes/admin-session-context.test.ts:173-185`
- Recommendation:
  Either:
  1. rename/reframe this route explicitly as “stable prompt inputs” and stop treating it as runtime-context inspection, or
  2. upgrade it to return the sectioned runtime snapshot plus bounded trace metadata from the canonical context contracts.

### Recorded avatar event snapshots omit two runtime sections that materially affect replies

- Severity: Medium
- Category: Observability / debuggability
- Problem:
  Recorded avatar snapshots include conversation state, user persona, director notes, scenario, and retrieval provenance, but they do not include Response Rules or Avatar Traits as explicit inspectable sections.
- Why it matters:
  A reply can be heavily shaped by response rules and traits. When those are absent from the recorded snapshot, operators cannot fully explain why a turn looked the way it did without reconstructing prompt inputs from other storage.
- Evidence:
  - `apps/core/src/application/services/runtime-inspector-event-context.ts:18-32`
  - `packages/shared/src/runtime-inspector-types.ts:282-313`
  - `apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.test.ts:395-483`
- Recommendation:
  Add a bounded representation for these sections on the recorded event path. If raw text is too sensitive, expose explicit summaries such as `responseRules`, `responseRuleCount`, `hasAvatarTraits`, and stable trait-section presence metadata.

### Full seven-section behavior is not proven at the route boundary

- Severity: Medium
- Category: Test quality
- Problem:
  The strongest route-level E2E proof for this EPIC only covers trait preference/fallback and a subset of sections. Conversation State and Retrieved Context are proven in unit tests on the send-message path, but not through the real HTTP route wiring.
- Why it matters:
  The highest-risk integration failure for this EPIC is not inside the pure prompt builder. It is losing one of the assembled sections between repositories/services/use case wiring and the actual LLM request. Consumer-boundary confidence should exist at the route boundary too.
- Evidence:
  - Route E2E only asserts `Director Notes`, `Response Rules`, `User Persona`, `World Context`, `Avatar Traits`: `apps/core/src/api/routes/conversation-runtime-context.e2e.test.ts:145-159`
  - Full seven-section assertion exists only in a unit test with mocked memory/retrieval services: `apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts:438-468`
- Recommendation:
  Add an in-process HTTP test that seeds working memory and typed retrieval so the route-level request proves all seven sections, not only the identity-source behavior.

### Documentation/status claims overstate current inspection capability

- Severity: Medium
- Category: Documentation alignment
- Problem:
  `PROJECT_STATUS.md` says admin session-context inspection exposes bounded explainable `contextTrace` metadata, but the published shared contract and actual route do not expose `contextTrace` at all.
- Why it matters:
  This is exactly the kind of status drift that makes EPIC-close decisions unreliable. Auditors and operators reading project status will assume an inspection surface exists that the code does not provide.
- Evidence:
  - `docs/PROJECT_STATUS.md:347-348`
  - `docs/API_CONTRACT.md:949-952`
  - `packages/shared/src/runtime-inspector-types.ts:387-399`
  - `apps/core/src/api/routes/admin-session-context.ts:45-59`
- Recommendation:
  Update `docs/PROJECT_STATUS.md` to match the current contract, or ship the missing `contextTrace` exposure and keep the stronger claim.

### Runtime-inspection contracts now have two competing vocabularies

- Severity: Low
- Category: Structural maintainability
- Problem:
  The codebase now carries both:
  - the canonical semantic section model used by the runtime path, and
  - a second legacy inspection vocabulary centered on `avatarPrompt`, `gmInstruction`, and `currentExchanges`.
- Why it matters:
  This increases the blast radius of future runtime-context changes. Adding or renaming a runtime section will require updates across internal section types, event mappings, the legacy admin session-context DTO, route tests, and API docs. That is avoidable manual drift.
- Evidence:
  - Canonical section model: `apps/core/src/domain/context/session-context.types.ts:43-105`
  - Legacy admin inspection model: `apps/core/src/application/use-cases/get-session-context/get-session-context.types.ts:7-18`
  - Shared admin DTO: `packages/shared/src/runtime-inspector-types.ts:387-399`
- Recommendation:
  Converge operator-facing inspection on the canonical sectioned contracts and keep any “stable prompt inputs” view as a derived presentation, not a separate primary contract.

## Architecture Review

The core EPIC implementation respects the modular-monolith rules.

- API layer remains thin. No prompt assembly logic is pushed into routes.
- Application layer still coordinates the turn flow. `SendMessageUseCase` assembles dependencies, invokes the context engine, resolves model selection, persists messages, and emits observability data.
- Domain ownership is clear:
  - `ContextEngine` owns deterministic context selection
  - Avatar prompt service owns textual rendering and trait fallback
  - shared DTOs stay in `packages/shared`
- No vendor leakage was found in the refactor path. LLM calls stay behind the adapter boundary.
- Async/non-blocking GM behavior remains intact.

Main architectural debt is not in the send-message path. It is in the operator surface, where the codebase still maintains a legacy inspection contract beside the new runtime model.

## Test Review

Strong tests:

- `apps/core/src/domain/context/context-engine.service.test.ts` proves precedence, tight-budget trimming, duplicate-resolution behavior, and deterministic outputs.
- `apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts:312-468` is a good consumer-boundary test because it asserts the actual LLM system prompt content, not only helper outputs.
- `apps/core/src/api/routes/conversation-runtime-context.e2e.test.ts` proves `computedTraits` preference and authored fallback on the normal HTTP message route.
- `apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.test.ts:308-483` strongly proves redaction behavior for turn-completed event payloads.

Weak tests:

- `apps/core/src/api/routes/admin-session-context.test.ts` proves only the legacy stable-input surface, which is no longer the interesting runtime behavior of this EPIC.
- `apps/core/src/api/routes/conversation-runtime-context.e2e.test.ts` is narrower than the EPIC DoD because it does not exercise Conversation State or Retrieved Context on the route boundary.

Missing tests:

- route-boundary proof for all seven runtime sections with seeded memory and retrieval
- operator-surface proof that runtime inspection exposes section precedence/trimming if that is intended behavior
- any test that reconciles `PROJECT_STATUS.md`’s `contextTrace` claim with the actual route contract

Implementation-coupled tests:

- some prompt-service tests assert exact headings and labels, which is somewhat coupled to implementation text. In this EPIC that is acceptable because section order and section labels are part of the contract, but those tests should not be the only proof. Fortunately they are backed by send-message and event-safety tests.

Residual risk:

- I ran the mandatory commands from the audit request plus `pnpm test:coverage`.
- I did not run `pnpm test:integration-e2e` or `pnpm test:stack-e2e`, because those were not part of the required command list.

## Documentation Gaps

- `docs/implementation-prompts/epic-8-2-runtime-context-assembly-refactoring/README.md` still shows every Definition of Done checkbox as unchecked even though `docs/EPICS.md` and `docs/PROJECT_STATUS.md` mark the EPIC complete.
- `docs/PROJECT_STATUS.md:347-348` overstates current admin session-context inspection behavior by claiming `contextTrace` exposure that the shipped contract does not provide.

## Path to A

Minimal steps needed to reach A:

1. Converge `/v1/admin/sessions/{sessionId}/context` on the canonical sectioned runtime model, or explicitly demote it to a legacy stable-input route and add a true runtime-context inspection route.
2. Expose bounded Response Rules and Avatar Traits diagnostics on recorded avatar snapshots so operator tooling can explain turn behavior without raw prompt leakage.
3. Add an HTTP-path test that proves all seven runtime sections with seeded memory and typed retrieval.
4. Remove the documentation mismatch around `contextTrace` and the unchecked EPIC README checklist.
5. Reduce the inspection-contract blast radius by deriving operator-facing views from the canonical sectioned contracts rather than maintaining a second primary vocabulary.

## Final Recommendation

- Close with debt

The core runtime refactor is solid and the build is healthy. I would close the EPIC for delivery of the main turn path, but not treat it as the final inspectability/maintainability end state until the operator-facing context contract is brought into line with the runtime model.
