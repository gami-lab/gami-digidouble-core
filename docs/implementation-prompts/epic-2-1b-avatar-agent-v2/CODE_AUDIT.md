# Code Audit - EPIC 2.1b - Avatar Agent v2 (Memory + Persona + RAG Awareness)

## Scope audited

Audit target:

- EPIC scope and DoD in this folder README
- Avatar v2 implementation in core domain/application/api layers
- shared runtime-inspector contracts and console consumption
- relevant tests proving consumer-visible behavior
- documentation alignment with current status and coverage plan

Primary evidence reviewed:

- docs/implementation-prompts/epic-2-1b-avatar-agent-v2/README.md
- docs/VISION.md
- docs/PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/TECH_STACK.md
- docs/DATA_MODEL.md
- docs/API_CONTRACT.md
- docs/TEST_STRATEGY.md
- docs/TEST_COVERAGE_PLAN.md
- docs/EPICS.md
- docs/PROJECT_STATUS.md

Implementation/test surface sampled deeply:

- apps/core/src/application/use-cases/send-message/send-message.use-case.ts
- apps/core/src/domain/context/context-engine.service.ts
- apps/core/src/domain/context/context-engine.service.test.ts
- apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts
- apps/core/src/application/use-cases/send-message/send-message.user-persona.use-case.test.ts
- apps/core/src/api/routes/admin-session-context.test.ts
- apps/core/src/api/routes/mappers/session-context.mapper.ts
- apps/core/src/domain/context/session-context.types.ts
- packages/shared/src/runtime-inspector-types.ts
- apps/console/src/api/runtime-inspector.ts

## Executive Summary

EPIC 2.1b is substantially delivered and operationally testable. Avatar responses now flow through a canonical context assembly path with persona, layered memory hooks, typed retrieval injection, and inspector trace exposure. Contract ownership improved versus earlier drift, and admin/console alignment is stronger.

The main remaining risk is structural: token budget policy is currently descriptive/telemetry-only in implementation, not enforced selection logic. This weakens the claim of budget-aware assembly under growth pressure. A secondary maintainability risk remains from mirrored internal and shared context trace shapes that can drift during future field additions.

## Final Grade

B

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (command succeeded via `pnpm test:coverage`; coverage report generated with thresholds enforced by Vitest config)

## Feature Confidence Matrix

| Feature                               | Expected Behavior                                                                                        | Evidence                                                                                                                          | Confidence (High/Medium/Low) | Notes                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Canonical Avatar prompt assembly path | SendMessage uses one deterministic context assembly and persona prompt assembly path                     | send-message.use-case constructs ContextEngine output then calls assemblePersonaPrompt with persona/memory/retrieval-derived data | High                         | Direct behavioral path is clear and covered by unit tests                                          |
| Persona-aware response shaping        | Different persona inputs produce different system prompts and are included when present                  | send-message.user-persona.use-case.test includes persona-delta and section assertions                                             | High                         | Consumer-observable in LLM request path                                                            |
| Memory hooks integration              | Short-term/working/long-term context can influence prompt assembly and GM input                          | send-message.use-case and context-engine tests verify memory layers in assembled context and traces                               | Medium                       | Mostly unit-level confidence; limited end-to-end evidence across real retrieval/memory persistence |
| Typed retrieval injection             | memory/world/media typed sections are assembled and mapped into prompt + context trace                   | typed retrieval service tests + send-message user-persona tests + context-engine tests                                            | High                         | Strong deterministic unit coverage                                                                 |
| Runtime inspector alignment           | Admin context endpoint exposes bounded context + trace; console composes it with runtime inspector model | admin-session-context tests, stack-e2e test file presence, runtime-inspector console loader                                       | High                         | Good contract-path coverage; redaction checks present                                              |
| Contract cleanup and shared ownership | Shared DTO ownership strengthened between core and console for inspector context                         | shared runtime-inspector types + mapper boundary in core + console API consumption                                                | Medium                       | Improved, but mirrored internal/shared shapes still create future drift risk                       |

## Strengths

- Clear modular layering remains intact: API route maps to use-case, use-case orchestrates, domain context assembly stays framework-agnostic.
- Avatar v2 behavior is materially improved and explicitly test-covered (persona and typed retrieval effects).
- Runtime observability is practical: context trace includes deterministic flag, selection, and policy metadata.
- Security hygiene in admin context responses is explicitly tested (no prompt/secret leakage strings).
- Console integration uses shared contracts and consolidates runtime-inspector load composition.

## Findings

### Token budget policy is not enforced by selection logic

- Severity: High
- Category: Architecture / Functional completeness
- Problem: Context assembly records token estimates but does not apply budget constraints; all segments are kept and trimmed stays empty.
- Why it matters: The EPIC and docs claim budget-aware deterministic context assembly. Without enforcement, context growth can silently degrade model reliability and cost under real conversation scale.
- Evidence: `applyBudgetAndSelection` applies every candidate and always pushes to kept; no budget check or trim branch in apps/core/src/domain/context/context-engine.service.ts.
- Recommendation: Implement deterministic budget gates per projection (avatar/gm), trim lowest-priority non-protected segments, and keep trace semantics aligned (`within_budget` vs `budget_exceeded`). Add regression tests with explicit overflow fixtures.

### Context budget tests currently codify non-enforcement behavior

- Severity: Medium
- Category: Test quality
- Problem: Tiny-budget test asserts no trimming and full knowledge inclusion, reinforcing current non-budget behavior.
- Why it matters: Tests currently protect behavior that conflicts with intended budget-aware selection, making future correction harder.
- Evidence: tiny-budget case in apps/core/src/domain/context/context-engine.service.test.ts expects empty trimmed and all retrieval sections present.
- Recommendation: Replace with consumer-inward assertions for deterministic protected-segment retention plus expected trimming of lower-priority segments when over budget.

### Context engine construction is hard-wired in SendMessage use case

- Severity: Medium
- Category: Architecture quality / Replaceability
- Problem: SendMessageUseCase directly instantiates ContextEngine instead of accepting a domain service dependency.
- Why it matters: Hard wiring increases coupling and limits test/control points for policy evolution, A/B policy tests, and alternative assembly strategies.
- Evidence: `const contextEngine = new ContextEngine()` in apps/core/src/application/use-cases/send-message/send-message.use-case.ts.
- Recommendation: Inject a context-assembly port/service into SendMessageUseCase constructor and provide default wiring at composition root.

### Internal and shared context contracts remain mirrored, increasing drift blast radius

- Severity: Medium
- Category: Structural maintainability
- Problem: Internal snapshot types and shared DTO shapes are highly similar and maintained in separate modules with mapper copy logic.
- Why it matters: Future field additions require repeated manual edits across domain type, shared type, mapper, and console consumer; drift risk remains non-trivial.
- Evidence: apps/core/src/domain/context/session-context.types.ts, packages/shared/src/runtime-inspector-types.ts, and apps/core/src/api/routes/mappers/session-context.mapper.ts.
- Recommendation: Keep boundary separation but reduce mirrored declarations through narrower shared primitives or compile-time mapper conformance tests to fail fast on drift.

### End-to-end behavioral proof is weaker than unit proof for Avatar v2 response adaptation

- Severity: Low
- Category: Test quality
- Problem: Strong unit tests exist, but there is limited API-level proof that persona/memory/retrieval adaptation remains observable through real route contracts over time.
- Why it matters: Unit confidence can miss integration regressions at route/use-case wiring boundaries.
- Evidence: strong use-case tests in send-message suite; no dedicated API-level scenario asserting persona-dependent response delta in conversation route tests.
- Recommendation: Add one focused API-level deterministic test (with null/fake LLM adapter contract assertions) that proves context sections affect assembled request shape and response envelope remains stable.

## Architecture Review

- Layering: Good adherence. No significant business logic leakage into API routes observed in sampled Avatar v2 flow.
- Ports/adapters: LLM adapter boundary respected. Typed retrieval is in application service; infra remains replaceable.
- Async behavior: GM and memory maintenance remain non-blocking, aligned with principles.
- Drift risk: Moderate due to hard-wired context engine construction and mirrored contract declarations.

## Test Review

Strong tests:

- Persona injection and differential prompt behavior in send-message user persona tests.
- Typed retrieval section injection tests through canonical assembly path.
- Admin session-context response auth/not-found/happy-path and redaction checks.
- Context engine deterministic behavior and dedupe conflict tests.

Weak tests:

- Budget semantics tests currently assert no trimming even under tiny budgets.
- Limited API-level behavior proof for persona/retrieval adaptation beyond use-case layer.

Missing tests:

- Deterministic overflow trimming expectations at domain context-engine level.
- One integration/e2e assertion that send-message route preserves Avatar v2 context effects under full route wiring.

Implementation-coupled tests identified:

- Some tests assert specific prompt section strings/headings. This is acceptable for contract stability but can become brittle if formatting-only refactors are frequent.

## Documentation Gaps

- `docs/PROJECT_STATUS.md` currently states token-budget-aware hardening; implementation behavior is telemetry-only and should be clarified until enforcement lands.
- `docs/TEST_COVERAGE_PLAN.md` should explicitly add context budget overflow trimming assertions once implemented.

## Path to A

Minimal steps to reach A:

1. Implement deterministic budget enforcement with protected-segment precedence and trace-accurate trimming.
2. Update context-engine tests to validate real overflow trimming outcomes.
3. Decouple SendMessageUseCase from concrete ContextEngine construction via injected assembler dependency.
4. Add compile-time conformance guardrails between internal context snapshot and shared runtime-inspector DTO mapping.
5. Add one API-level regression test proving persona/retrieval adaptation remains consumer-visible through route contracts.

## Final Recommendation

Close with debt
