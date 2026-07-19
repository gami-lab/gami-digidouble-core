# Code Audit — EPIC 8.1 Avatar Trait Structuring

## Scope audited

- EPIC definition: `docs/implementation-prompts/epic-8-1-avatar-trait-structuring/README.md`
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
  - shared trait and response contracts
  - avatar persistence and repository read/write paths
  - `PrepareScenarioAvatarTraitsUseCase`
  - `POST /v1/scenarios/{scenarioId}/prepare-avatar-traits`
  - admin trigger and read-only inspection UI
  - unit, route, repository, admin, and stack-e2e tests related to the EPIC

## Executive Summary

EPIC 8.1 is mostly delivered. The fixed seven-field trait schema exists, persistence is narrow and clean, the preparation flow is explicit and rerunnable, and the admin app can trigger and inspect results without editing them. The implementation largely respects the modular-monolith boundaries and avoids vendor leakage into domain logic.

The main reasons this is not an A or B are:

- the public preparation route has a real validation bug on bodyless-input handling
- the most important feature promises about trait quality are not proven by tests
- the persistence read path trusts malformed `computed_traits` JSON too much

The result is a solid architectural base with meaningful correctness and confidence gaps still open.

## Final Grade

C

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage` via `@gami/core`; all files `86.54%` statements, `84.80%` branches, `96.62%` functions, `86.54%` lines)

## Feature Confidence Matrix

| Feature                                           | Expected Behavior                                                           | Evidence                                                                                 | Confidence (High/Medium/Low)                                                               | Notes                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------- |
| Fixed trait schema ownership                      | One canonical 7-field schema shared across API/domain usage                 | `packages/shared/src/entity-types.ts`, domain re-export, parser tests, API contract docs | High                                                                                       | Ownership is clear and mostly centralized.                                  |
| Avatar persistence and read DTOs                  | `computedTraits` persisted separately and surfaced as `AvatarComputedTraits | null`                                                                                    | repository port/write path, Postgres/in-memory repo tests, create/update/list avatar tests | High                                                                        | Narrow write path is a strong design choice. |
| Explicit scenario-scoped preparation action       | Trait computation is explicit, rerunnable, and scenario-scoped              | use-case tests, route tests, stack-e2e file                                              | Medium                                                                                     | Contract exists, but route validation is flawed for non-object JSON bodies. |
| Grounded/avatar-specific/concise trait generation | Traits avoid world duplication, avoid invention, stay concise               | prompt constraints tests, minimal real-provider stack assertions                         | Low                                                                                        | Observable behavior is not actually proven.                                 |
| Admin trigger and read-only inspection            | Operators can trigger preparation and inspect status/traits without editing | admin API wrapper test, `ScenarioDetailPage.trait-preparation.test.tsx`                  | High                                                                                       | UI behavior is well covered.                                                |

## Strengths

- Architecture is mostly clean. The route is thin, orchestration lives in an application use case, and infrastructure concerns stay behind ports/adapters.
- The persistence design is disciplined. `saveComputedTraits` is a separate write path instead of piggybacking on generic avatar updates.
- Shared contract ownership is materially better than average. `AvatarComputedTraits`, `AvatarSummary`, and `PrepareAvatarTraitsResponse` are defined once and reused.
- The admin slice stays minimal and aligned with the EPIC non-goals: explicit trigger, read-only inspection, no speculative editing workflow.
- Core build health is strong: lint, strict typecheck, unit suite, and coverage all pass.

## Findings

### Bodyless route validation is broken for valid JSON scalars and `null`

- Severity: High
- Category: API contract / correctness
- Problem:
  `POST /v1/scenarios/{scenarioId}/prepare-avatar-traits` only rejects bodies by checking `Object.keys(request.body).length > 0` in the handler. That guard fails for non-object JSON values. `null` throws and becomes a `500 INTERNAL_ERROR`; scalar/array/boolean JSON bodies bypass validation entirely and the route proceeds with preparation logic.
- Why it matters:
  The contract says this action accepts no request body and should reject bodied requests with `400 VALIDATION_ERROR`. Returning `500` or `200` instead breaks the API contract and makes client behavior transport-shape dependent.
- Evidence:
  `apps/core/src/api/routes/scenarios.ts:412-423`.
  Directly verified on July 19, 2026 with Fastify `inject()`:
  - `payload: null` -> `500 INTERNAL_ERROR`
  - `payload: 5` -> `200`
  - `payload: []` -> `200`
  - `payload: true` -> `200`
    `docs/API_CONTRACT.md:590-591` says the route rejects request bodies and expects no body.
- Recommendation:
  Add explicit body-shape validation for `undefined` only, or reject any parsed body value including scalars/arrays/null before entering the use case. Add route tests for `null`, numbers, booleans, arrays, and string JSON bodies.

### The core trait-quality promises are not proven by observable tests

- Severity: High
- Category: Test quality / functional completeness
- Problem:
  The EPIC promises that generated traits stay concise, avatar-specific, grounded, and avoid redundant world-context copying. Current tests do not prove those outcomes. Most of the protection is indirect: prompt-string assertions and a real-provider smoke test that only checks two fields are non-empty.
- Why it matters:
  This EPIC's product value is not "JSON exists"; it is that the derived JSON is useful and safe. Right now the suite proves structure and plumbing, not the critical behavior the README calls out.
- Evidence:
  `docs/implementation-prompts/epic-8-1-avatar-trait-structuring/README.md:48-51` and `docs/EPICS.md` define these behaviors as part of DoD.
  `apps/core/src/application/use-cases/prepare-scenario-avatar-traits/prepare-scenario-avatar-traits.prompt.test.ts:54-75` only checks prompt wording.
  `apps/core/src/api/routes/prepare-avatar-traits.stack-e2e.test.ts:216-231` only checks `identity.length > 0` and `personality.length > 0` under a real provider.
- Recommendation:
  Add behavior-level regression tests around representative fixtures:
  - avatar-specific facts remain in avatar fields while generic world facts do not dominate output
  - unsupported facts are not introduced for a curated scenario/avatar pair
  - field length remains bounded under a real-provider smoke test
    If deterministic proof is impossible, add clearly bounded provider-gated contract checks that validate these behaviors on curated fixtures instead of only checking for non-empty arrays.

### Postgres read-path normalization trusts malformed `computed_traits` too much

- Severity: Medium
- Category: Contract integrity / maintainability
- Problem:
  `PostgresAvatarRepository.normalizeComputedTraits()` accepts any JSON object and casts it directly to `AvatarComputedTraits` without validating keys or value types.
- Why it matters:
  The API contract promises a stable 7-field structure. If the database contains malformed JSON because of manual edits, older data, or migration mistakes, the repository can surface contract-invalid data directly to API consumers.
- Evidence:
  `apps/core/src/infrastructure/db/repositories/postgres-avatar.repository.ts:88-108`.
  In contrast, the preparation parser itself is schema-locked in `apps/core/src/application/use-cases/prepare-scenario-avatar-traits/prepare-scenario-avatar-traits.parsing.ts:3-39`.
- Recommendation:
  Reuse the same field-level normalization logic on repository reads, or add a shared validator/normalizer for persisted `computed_traits`. Add repository tests for malformed JSONB rows.

### Per-avatar failure handling leaks raw error messages and has weak observability

- Severity: Medium
- Category: Operational quality / error handling
- Problem:
  The use case catches all exceptions and returns `reason: error.message` for each failed avatar. That mixes user-facing contract output with raw provider/repository error text and does not emit a structured success/failure event for the batch itself.
- Why it matters:
  This weakens debuggability and can expose low-level details through an API result while still giving operators little structured telemetry about how many avatars failed and why.
- Evidence:
  `apps/core/src/application/use-cases/prepare-scenario-avatar-traits/prepare-scenario-avatar-traits.use-case.ts:85-101`.
  The public contract exposes `reason: string` in `docs/API_CONTRACT.md:601-603`.
- Recommendation:
  Normalize failure reasons to a small explicit code set for API consumers, and add structured logging/metrics for batch runs (`scenarioId`, avatar counts, prepared count, failed count, failure codes).

### Trait field evolution has a multi-file blast radius

- Severity: Low
- Category: Structural maintainability
- Problem:
  The fixed field set is intentionally shared, but its operational representation is still hand-maintained in several places: shared type, prompt JSON shape, parsing constant, and admin rendering labels/order.
- Why it matters:
  The grading model explicitly disallows an A when adding a field requires 4+ manual edits. This EPIC still has that blast radius, which increases drift risk for future schema evolution or renames.
- Evidence:
  `packages/shared/src/entity-types.ts:22-38`
  `apps/core/src/application/use-cases/prepare-scenario-avatar-traits/prepare-scenario-avatar-traits.parsing.ts:3-12`
  `apps/core/src/application/use-cases/prepare-scenario-avatar-traits/prepare-scenario-avatar-traits.prompt.ts:7-34`
  `apps/admin/src/scenarios/ScenarioAvatarForms.tsx:129-136`
- Recommendation:
  Centralize the canonical field metadata once, then derive parsing order and admin rendering order from it. The prompt prose will still need manual wording, but the structural list should not be duplicated.

## Architecture Review

The architecture is in good shape overall.

- API -> Application -> Infrastructure separation is respected on the main path.
- Trait preparation is explicitly not runtime prompt assembly, which matches the EPIC boundary and avoids architecture drift into EPIC 8.2.
- LLM usage stays behind the existing adapter/role-resolution stack; there is no provider SDK leakage into business logic.
- The dedicated `saveComputedTraits` port is a strong design decision. It keeps author-authored fields and derived fields clearly separated.

Main concerns:

- The route-level validation bug is an API-boundary failure, not a layering failure, but it is still a contract breach.
- The repository read path is too trusting at the infrastructure boundary and should protect the shared contract more aggressively.

## Test Review

Strong tests:

- Repository tests proving `saveComputedTraits` overwrites prior derived data without mutating author-authored fields.
- Use-case tests for scenario scoping, per-avatar failure isolation, and recomputation after author text changes.
- Admin page tests proving loading, refresh-after-success, failure display, and read-only trait rendering.

Weak tests:

- Prompt wording tests are useful guardrails, but they are implementation-coupled and do not prove output behavior.
- Real-provider stack-e2e assertions are too weak for the EPIC's central quality claims.

Missing tests:

- `prepare-avatar-traits` route with `null`, scalar, boolean, and array JSON bodies.
- Repository read tests for malformed persisted `computed_traits`.
- Sanitized failure-code behavior if provider/repository errors occur.
- Behavior-level regression checks for grounded/avatar-specific outputs.

Implementation-coupled tests:

- `prepare-scenario-avatar-traits.prompt.test.ts` is coupled to prompt wording rather than consumer-observable output.

Additional note:

- `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm test:coverage` all passed in this audit.
- I did not run `pnpm test:integration-e2e` or `pnpm test:stack-e2e` as part of build health for this audit.

## Documentation Gaps

- `docs/implementation-prompts/epic-8-1-avatar-trait-structuring/README.md:42-52` still shows every Definition of Done checkbox as unchecked even though `docs/EPICS.md` and `docs/PROJECT_STATUS.md` mark the EPIC complete.
- I did not find a required source-of-truth update missing outside that README inconsistency.

## Path to A

Minimal steps needed to reach A:

1. Fix the preparation route body-validation bug and add explicit tests for all invalid JSON body shapes.
2. Harden repository reads so malformed `computed_traits` cannot leak invalid contract data.
3. Add behavior-level regression coverage for the EPIC's critical promises: grounded, avatar-specific, concise output.
4. Normalize per-avatar failure reasons and add batch-level observability for preparation runs.
5. Reduce the trait-field blast radius by centralizing field metadata and update the EPIC README checklist to reflect actual completion status.

## Final Recommendation

- Rework before close

The implementation is close, but I would not close the EPIC cleanly while the public preparation route still violates its own no-body contract and the headline trait-quality behaviors remain unproven by tests.
