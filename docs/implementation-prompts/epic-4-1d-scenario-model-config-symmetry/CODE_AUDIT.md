# Code Audit — EPIC 4.1d Scenario Model Config Symmetry

## Scope audited

Commits `e4bb18f8` (shared type, resolver, Postgres read-path fix), `54510782` (admin API
validation/mapping/schema), `2a53d865` (trait-preparation decoupling), and `1be7b1ed` (admin UI and
docs), measured against the EPIC [README.md](README.md) Definition of Done and the `4.1d` entry that
was moved from the backlog in `docs/EPICS.md`.

`e650073c` (GM prompt participants fix) sits inside the same commit range but is unrelated to this
EPIC and was not audited.

Files reviewed:

- `packages/shared/src/model-catalog.ts`
- `apps/core/src/domain/model-config/model-resolution.service.ts` (+ test)
- `apps/core/src/application/services/model-resolution-runtime.service.ts` (+ test)
- `apps/core/src/application/use-cases/prepare-scenario-avatar-traits/prepare-scenario-avatar-traits.use-case.ts` (+ test)
- `apps/core/src/infrastructure/db/repositories/postgres-scenario.repository.ts` (+ integration test)
- `apps/core/src/api/routes/{scenarios,model-selection-mappers,model-selection-validation}.ts` (+ unit and stack-e2e tests)
- `apps/admin/src/scenarios/{ScenarioCreatePage,ScenarioEditForm,ScenarioFormFields,ScenarioDetailView,model-selection-form}.ts(x)` (+ tests)
- `docs/{API_CONTRACT,DATA_MODEL,EPICS,PROJECT_STATUS}.md`

## Executive Summary

The EPIC is delivered. Every DoD item is implemented and backed by a test at the right boundary:
domain resolver unit tests, use-case tests for trait preparation, a Postgres integration test for
the `memoryOverride` read-back regression, and stack E2E round-tripping both new slots through
create and update. Layering is respected: the domain owns the new resolution primitive, the
application layer adapts it to adapters, and the API layer only validates and maps.

The weaknesses are structural rather than functional. The EPIC repeated a `{ provider, model }`
shape across about 10 places instead of collapsing it, so adding a fifth slot would take many
hand-written edits. The new runtime helper duplicates `resolveRoleLlmCall`. Trait preparation is
still labelled `role: 'avatar'` in logs and adapter error messages, which is exactly the coupling
this EPIC was meant to remove. Lint passes, but only because several new `eslint-disable`
suppressions were added.

## Final Grade

**B** — solid and correctly tested. It does not get an A because adding a field takes 4+ manual
edits (it is roughly 10) and because new complexity suppressions were added to make lint pass.

## Build Health

- lint: **PASS** (7/7 tasks)
- typecheck: **PASS** (7/7 tasks)
- tests: **PASS** — core 1157/1157 (166 files), admin 91/91 (13 files)
- coverage (`pnpm test:coverage`, core): 87.32% statements · 83.89% branches · 96.88% functions · 87.32% lines
- additionally run against local stack: `scenarios.stack-e2e.test.ts` 13/13 PASS,
  `postgres-scenario.repository.integration.test.ts` 9/9 PASS

## Feature Confidence Matrix

| Feature                                           | Expected Behavior                                                                                  | Evidence                                                                                                                              | Confidence | Notes                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| Postgres read-path fix                            | Persisted `memoryOverride`/`avatarOverride` survive read-back                                      | `postgres-scenario.repository.integration.test.ts` (new case); stack E2E PATCH response asserts both slots                            | High       | Regression is pinned at the boundary that exposed it                    |
| Shared `avatarOverride` type                      | Field exists on `ScenarioModelSelection` and type-checks end to end                                | Typecheck across core/admin/shared                                                                                                    | High       | —                                                                       |
| Resolver `avatar` branch                          | `avatar.llmOverride` > scenario `avatarOverride` > scenario default > global role > global default | `model-resolution.service.test.ts` — new cases for scenario override over default, and entity override over scenario override         | High       | Session/request precedence covered by pre-existing tests                |
| Scenario/global-default-only primitive            | Ignores role overrides and all avatar overrides                                                    | `resolveScenarioOrGlobalDefault` unit tests (scenario default; global default ignoring role and `avatarOverride`)                     | High       | —                                                                       |
| Trait-prep decoupling                             | Trait prep uses scenario default, then global default, never avatar/role overrides                 | Use-case tests assert adapter-registry provider **and** the model on the outgoing LLM request in both fallback cases                  | High       | Tests observe the outgoing request, not internals                       |
| API validation                                    | Unknown catalog entries rejected for new slots; all-empty selection rejected                       | `model-selection-validation.test.ts`; stack E2E 400 loop over `defaultProfile`/`avatarOverride`/`memoryOverride`                      | High       | Stack E2E does not cover an invalid `gameMasterOverride` (pre-existing) |
| API round-trip (create + PATCH)                   | All four slots persisted and returned                                                              | Stack E2E create (4 slots) and PATCH set (3 slots) / clear                                                                            | High       | —                                                                       |
| Live avatar turns honor scenario `avatarOverride` | `send-message` uses the scenario avatar override                                                   | Resolver unit test plus `model-resolution-runtime.service.test.ts`; `send-message` passes `scenario.modelSelection` through unchanged | Medium     | No use-case test drives a turn and checks the adapter or model chosen   |
| Memory maintenance honors `memoryOverride`        | Compaction uses the scenario memory override                                                       | `memory-maintenance.model-resolution.service.test.ts` (existing)                                                                      | High       | —                                                                       |
| Admin create form                                 | Avatar/Memory slots captured and sent                                                              | `ScenarioCreatePage.test.tsx` asserts `createScenario` payload                                                                        | High       | —                                                                       |
| Admin edit form                                   | Avatar/Memory slots prefilled and saved                                                            | `ScenarioDetailPage.test.tsx` asserts prefill only                                                                                    | Medium     | Update payload for new slots not asserted on submit                     |
| Admin detail view                                 | Displays all four slots                                                                            | `ScenarioDetailPage.test.tsx` text assertions                                                                                         | High       | —                                                                       |
| Backward compatibility                            | Scenarios without new slots resolve unchanged                                                      | Pre-existing resolver/use-case tests untouched and passing                                                                            | High       | —                                                                       |

## Strengths

- **Regression fixed with a regression test.** The silent `memoryOverride` drop in
  `readScenarioModelSelection` was fixed and pinned with an integration test at the repository
  boundary, in line with AGENTS.md.
- **Trait-prep tests are behavioural.** They set conflicting values at every competing layer
  (global role override, entity `llmOverride`, scenario `avatarOverride`). They then check which
  provider was requested and which model was sent on the outgoing request. This proves the
  decoupling rather than mirroring the implementation.
- **Clean layering.** `resolveScenarioOrGlobalDefault` is a pure domain function. The application
  helper only wires repositories and adapters, and the API layer only validates and maps. No vendor
  types leak into the domain.
- **Precedence test for the ambiguous case.** A dedicated test pins the entity `llmOverride` above
  the new scenario `avatarOverride`.
- **Docs synced in the same change.** API_CONTRACT precedence is rewritten per role, DATA_MODEL
  notes the four-slot shape, and EPICS/PROJECT_STATUS mark the EPIC done.

## Findings

### Model-profile shape is hand-repeated across ~10 sites

- Severity: Medium
- Category: structural-maintainability / field drift
- Problem: Each slot is listed by hand in these places:
  - the shared type
  - the resolver branch
  - the Postgres reader (read call plus the all-undefined guard)
  - the validator (guard plus call)
  - the mapper (one spread block per slot)
  - the Fastify create and update schemas (an identical 9-line object per slot, 8 copies in total)
  - the admin `fromScenarioModelSelection` and `toScenarioModelSelection`
  - the create-page state, partial check and props
  - the edit-form state, partial check and props
  - the `ScenarioFormFields` props and fields
  - the detail-view lines
- Why it matters: Adding one slot cost this EPIC about 12 files. A missed site fails silently, and
  that is exactly how the `memoryOverride` read-back bug this EPIC fixed came about.
- Evidence: `scenarios.ts` (8 identical `{type:'object',required:['provider','model'],…}` blocks);
  `model-selection-mappers.ts` (4 identical spread blocks); `model-selection-form.ts` (4 identical
  blocks); `postgres-scenario.repository.ts` (manual 4-way guard).
- Recommendation:
  - Export a `SCENARIO_MODEL_SLOTS = ['defaultProfile','avatarOverride','gameMasterOverride','memoryOverride'] as const` from `@gami/shared`.
  - Derive the schema properties, mapper, validator, Postgres reader and admin conversions by
    iterating over it.
  - Hoist a single `modelProfileSchema` constant in `scenarios.ts`.

### `resolveScenarioOrGlobalDefaultLlmCall` duplicates `resolveRoleLlmCall`

- Severity: Low
- Category: duplication
- Problem: The new helper repeats `resolveRoleLlmCall` almost line for line: the null-registry
  fallback, config loading, model trimming, adapter lookup and return shape. Only the domain call
  differs.
- Why it matters: Two copies of runtime resolution can drift. A fix to model normalisation or
  fallback has to be made in both.
- Evidence: `model-resolution-runtime.service.ts:36-108`.
- Recommendation: Extract a private `toResolvedLlmCall(registry, resolved, roleLabel)` and a
  `loadModelConfig(...)`, and have both helpers use them.

### Trait preparation still reports itself as role `avatar`

- Severity: Low
- Category: observability
- Problem: After decoupling, trait preparation still identifies as `avatar` in two places:
  - it logs `logResolvedLlmCall({ role: 'avatar', … })`;
  - `resolveAdapterOrThrow(..., 'avatar')` produces "Provider 'x' is configured for role 'avatar'
    but no API key is available."
- Why it matters: An operator debugging a missing key during trait preparation is told to look at
  the avatar role config. That is the wrong place, because trait preparation now reads the scenario
  or global default.
- Evidence: `prepare-scenario-avatar-traits.use-case.ts:130`; `model-resolution-runtime.service.ts:102`.
- Recommendation: Widen the label type to a free `string` (or add `'traitPreparation'`) and pass a
  distinct label. Add a test that asserts the 503 message.

### Lint passes via new suppressions

- Severity: Low
- Category: code quality
- Problem: These `eslint-disable` lines were added:
  - `complexity` in `readScenarioModelSelection` and `ScenarioSummarySection`
  - `max-lines-per-function, complexity` in `ScenarioEditForm`
  - `max-lines-per-function` in `ScenarioCreatePage` and in two test describes
  - `no-unnecessary-condition` in the resolver
- Why it matters: The suppressions hide the per-slot duplication described above. They also accumulate.
- Evidence: `git show 1be7b1ed e4bb18f8 54510782 | grep eslint-disable`.
- Recommendation: Do the slot-iteration refactor from the first finding; most suppressions then go
  away.

### Dead branch in `resolveScenarioSelection`

- Severity: Low
- Category: dead code
- Problem: `ModelRole` is `'avatar' | 'gameMaster' | 'memory'`. The explicit `avatar` branch makes
  the trailing `return defaultProfile` unreachable, and a lint suppression plus a comment were added
  to keep it.
- Why it matters: It is noise and it suggests a fourth role exists.
- Evidence: `model-resolution.service.ts:31-37`.
- Recommendation: Use a `Record<ModelRole, keyof ScenarioModelSelection>` lookup
  (`{avatar:'avatarOverride', gameMaster:'gameMasterOverride', memory:'memoryOverride'}`) and a
  single `?? defaultProfile`.

### Admin copy for the scenario default is inaccurate

- Severity: Low
- Category: UX correctness
- Problem: The help text for "Scenario default model" says it is the fallback "for live Avatar
  turns". It is also the fallback for the Game Master and Memory, and it is now the primary model
  for trait preparation.
- Why it matters: This EPIC's whole purpose is to let operators choose the trait-preparation model
  on purpose. The UI hides where that model is chosen.
- Evidence: `ScenarioFormFields.tsx:136`.
- Recommendation: Use a phrase like "Fallback for all roles; also used for one-time avatar trait
  preparation."

### Missing assertions: edit-form submit payload and live-turn scenario avatar override

- Severity: Low
- Category: test-coverage
- Problem: Two behaviours are not asserted:
  - the edit form's `updateScenario` payload for the new slots (only prefill is checked);
  - that a `send-message` turn selects the scenario `avatarOverride`, which the EPICS test plan
    lists as "confirm conversation turns use it".
- Why it matters: Both depend on wiring that the resolver unit tests do not exercise.
- Evidence: `ScenarioDetailPage.test.tsx` (prefill only); no `avatarOverride` reference in
  `send-message` tests.
- Recommendation: Add one edit-submit assertion and one `send-message` use-case test that sets a
  scenario `avatarOverride` and checks the adapter or model chosen.

### Unrelated formatting churn in the EPIC commit

- Severity: Low
- Category: hygiene
- Problem: `1be7b1ed` also reformats `KnowledgeSourceRow` in `ScenarioDetailView.tsx` and several
  unrelated lines in `ScenarioCreatePage.test.tsx`.
- Why it matters: It makes review noisier. AGENTS.md asks for surgical changes.
- Evidence: `git show 1be7b1ed -- apps/admin/src/scenarios/ScenarioDetailView.tsx`.
- Recommendation: Keep formatter-only changes in a separate `chore:` commit.

## Architecture Review

- **Direction respected:** API → Application → Domain → Infrastructure. The resolution primitive
  lives in the domain, the adapter selection in an application service, and the persistence parsing
  in infrastructure.
- **No vendor leakage:** The domain only sees `ProviderName` and string model IDs from the shared
  catalog.
- **Async boundaries unchanged:** Trait preparation stays a one-time admin action, and the Game
  Master and memory paths are untouched.
- **Contract ownership:** `ScenarioModelSelection` is owned by `@gami/shared`, and core aliases it as
  `ScenarioModelSelectionConfig`. That is fine. The Fastify JSON schema is a second, hand-written
  copy of the same contract, which is the main drift risk.
- **Smallest solution:** Mostly yes. The one questionable addition is the parallel runtime helper,
  where a single parameterised helper would have been enough.
- No architecture drift detected.

## Test Review

**Strong tests**

- `prepare-scenario-avatar-traits.use-case.test.ts`, "model resolution" block: puts every competing
  override in conflict and checks the request that actually goes out.
- `postgres-scenario.repository.integration.test.ts`: the new read-back case is the regression guard
  for the fixed bug.
- `scenarios.stack-e2e.test.ts`: real HTTP round-trip for create and PATCH, plus 400 validation for
  the new slots.
- `model-resolution.service.test.ts`: the entity-over-scenario-override precedence case.
- `ScenarioCreatePage.test.tsx`: checks the outgoing API payload through user-level form events.

**Weak tests**

- The stack E2E invalid-catalog loop runs several cases inside one `it`. The first failure hides
  the rest, so `it.each` would be clearer.
- The mapper tests (`model-selection-mappers.test.ts`) only check trimming of individual fields, and
  are close to mirroring the implementation. They are acceptable given how small the mapper is.

**Missing tests**

- The edit form's submit payload for `avatarOverride`/`memoryOverride`.
- A `send-message` use-case test showing the scenario `avatarOverride` drives live-turn model
  selection.
- The adapter-unavailable (503) message for trait preparation.

**Implementation-coupled tests**

- None significant. The use-case tests check `llmAdapterRegistry.get` calls, but they pair that
  with assertions on the outgoing request model, so they are not mock-only.

## Documentation Gaps

- `docs/TEST_COVERAGE_PLAN.md` / `docs/TEST_STRATEGY.md`: no mention of the new trait-prep
  resolution or the four-slot round-trip coverage. Optional, because these docs track strategy
  rather than individual tests.
- `docs/ARCHITECTURE.md`: if model-resolution precedence is described there, it should point to
  API_CONTRACT as the source of truth, or reflect the scenario `avatarOverride` step and the
  trait-prep exception.
- Admin UI help text (see the finding above) is a user-facing documentation gap.

API_CONTRACT, DATA_MODEL, EPICS and PROJECT_STATUS are correctly updated.

## Path to A

1. Add `SCENARIO_MODEL_SLOTS` to `@gami/shared`. Derive the Fastify schemas, mapper, validator,
   Postgres reader and admin conversions from it, and hoist one `modelProfileSchema`. This brings
   "add a slot" down to 1–2 edits and removes most of the new suppressions.
2. Merge the two runtime resolution helpers behind one shared core, and give trait preparation its
   own log and error label.
3. Replace the dead `avatar` branch with a role→slot lookup.
4. Add the edit-form submit assertion and a `send-message` scenario-`avatarOverride` test.
5. Fix the "Scenario default model" help text.

## Final Recommendation

**Close with debt.** The functional DoD is met and proven at the correct boundaries, and the build
is green. Track the slot-duplication refactor (Path to A, item 1) as follow-up debt before any
further model-selection slot is added.
