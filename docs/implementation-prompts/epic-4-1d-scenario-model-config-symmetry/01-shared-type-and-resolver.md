# Scenario `avatarOverride` Type, Resolver Precedence & Read-Path Fix

# Context

This is the core type/resolver slice of EPIC `4.1d`. Today, global model config has four slots
(default + `avatar`/`gameMaster`/`memory` role overrides, in
`apps/core/src/domain/model-config/model-config.types.ts`), but the scenario-level
`ScenarioModelSelection` type (`packages/shared/src/model-catalog.ts`) only has `defaultProfile`,
`gameMasterOverride`, and `memoryOverride` — no `avatarOverride`.
`ModelResolutionService.resolveScenarioSelection`
(`apps/core/src/domain/model-config/model-resolution.service.ts`) already branches on
`role === 'gameMaster'` and `role === 'memory'` to prefer the scenario-level override before
falling back to `defaultProfile`; the `avatar` role falls through to
`scenarioModelSelection.defaultProfile` with no override branch. This prompt adds the missing type
field and resolver branch, and separately introduces the scenario/global-default-only resolution
path that avatar trait preparation will use in prompt `03` (bypassing per-role overrides entirely,
since trait prep must not inherit the Avatar entity's own `llmOverride` or the global `avatar` role
override).

While in this area, also fix a pre-existing bug in the same contract: `memoryOverride` already
exists on `ScenarioModelSelection` (added in the EPIC-6.1 lineage) and the Postgres write path
persists it untouched as JSONB, but the read path in
`apps/core/src/infrastructure/db/repositories/postgres-scenario.repository.ts`
(`readScenarioModelSelection`, roughly lines 58-73) only reconstructs `defaultProfile` and
`gameMasterOverride` — `memoryOverride` is silently dropped on every read-back after a restart or
refetch. This is the same kind of field-enumeration drift this prompt is about to introduce a third
instance of (`avatarOverride`), so fix it alongside the new field rather than in a separate pass.

# Scope

In scope:

- Add `avatarOverride?: ModelProfile` to `ScenarioModelSelection` in
  `packages/shared/src/model-catalog.ts`.
- Add an `if (role === 'avatar')` branch to `resolveScenarioSelection` in
  `model-resolution.service.ts`, returning `scenarioModelSelection.avatarOverride ??
scenarioModelSelection.defaultProfile`, mirroring the existing `gameMaster`/`memory` branches
  exactly.
- Add a new, small resolution function (e.g. `resolveScenarioOrGlobalDefault`) alongside
  `ModelResolutionService.resolve` that returns
  `scenarioModelSelection?.defaultProfile?.provider ?? config.globalDefault.provider` /
  `...model ?? config.globalDefault.model` — deliberately bypassing `config.roleOverrides`,
  `avatarOverride`, `requestOverride`, and `sessionOverride`. This is the function prompt `03` will
  call for avatar trait preparation.
- Fix `readScenarioModelSelection` (and its helper `readModelProfile`) in
  `postgres-scenario.repository.ts` to also restore `memoryOverride` (and the new
  `avatarOverride`) from the persisted JSONB, instead of only `defaultProfile`/`gameMasterOverride`.
  Do not touch the write path — it already persists the full object untouched.
- Unit tests for the new resolver branch and the new scenario-or-global-default function, plus a
  repository test proving a scenario with only `memoryOverride` (and one with only
  `avatarOverride`) set survives a Postgres write-then-read round trip.

Out of scope:

- Wiring `avatarOverride`/`memoryOverride` through the admin API request schema/validation/mapper
  (prompt `02`) — this prompt only fixes the repository's read mapping and the domain type/resolver.
- Changing the avatar trait preparation use case itself (prompt `03` — this prompt only adds the
  resolution primitive it will call).
- Changing the live conversation (`send-message.use-case.ts`) or Game Master call sites — they
  already pass `scenarioModelSelection` through unchanged and will pick up the new `avatarOverride`
  branch automatically, with no code change needed there.
- The in-memory scenario repository — it already passes `modelSelection` through generically with
  no field enumeration and needs no change.

# Relevant Docs

- `docs/API_CONTRACT.md` (current precedence text, ~lines 160-167 — will need rewriting in prompt
  `05`, but read it now to understand the documented contract you're extending)
- `docs/EPICS.md` (`4.1d` and `4.1c` entries)

# Implementation Guidance

- `ScenarioModelSelection` lives in `packages/shared/src/model-catalog.ts` next to
  `ModelProfile`/`ModelSelectionOverride`. Adding the field here flows automatically into
  `apps/core/src/domain/model-config/model-config.types.ts`'s `ScenarioModelSelectionConfig` alias
  and into the shared DTOs in `packages/shared/src/web-contract-types.ts`
  (`CreateScenarioRequest`/`UpdateScenarioRequest`) with no further type-level edits needed in
  those files.
- In `model-resolution.service.ts`, `resolveScenarioSelection` is a small `if`-chain keyed on
  `role`. Add the `avatar` branch in the same style as `gameMaster`/`memory` — do not restructure
  the function into a lookup table or role-keyed record unless the existing style already uses one
  (it doesn't; keep the diff minimal).
- Be careful of a naming collision already present in this file: `resolveAvatarOverrideProvider`/
  `resolveAvatarOverrideModel` resolve the **Avatar entity's own** `llmOverride` (plus
  `requestOverride`/`sessionOverride`), which is a completely different concept from the new
  **scenario-level** `avatarOverride` field. Do not reuse those function names or conflate the two
  in comments or variable names — name the new scenario override local variable explicitly (e.g.
  `scenarioAvatarOverride`) wherever it could be ambiguous.
- For the new scenario-or-global-default function: it must NOT accept or consult `role`,
  `config.roleOverrides`, `avatarOverride` (entity), `requestOverride`, or `sessionOverride` — only
  `config.globalDefault` and `scenarioModelSelection?.defaultProfile`. Keep its signature minimal:
  `(config: ModelConfig, scenarioModelSelection: ScenarioModelSelectionConfig | undefined) => {
provider: ProviderName; model: string }`.
- Export the new function from `model-resolution.service.ts` alongside `resolve`, so prompt `03`
  can import it directly (likely via a small wrapper in `model-resolution-runtime.service.ts`,
  similar to `resolveRoleLlmCall` — but that wiring decision belongs to prompt `03`; here just
  expose the primitive).
- For the read-path fix, read `packages/shared/src/model-catalog.ts` as the single source of truth
  for which keys `readScenarioModelSelection` must reconstruct, and reuse the existing
  `readModelProfile` helper for the two additional fields rather than duplicating its parsing
  logic. Rows written before this fix (without `memoryOverride`/`avatarOverride` persisted at all)
  must continue to read back as `undefined` for those fields, not throw.

# Constraints

- KISS: the new function is intentionally simpler than `resolve()` — do not generalize it into an
  options-bag API matching `resolve()`'s shape.
- DRY: do not duplicate `resolveBaseProvider`/`resolveBaseModel` logic; note that calling them with
  role `'avatar'` would reintroduce the global avatar role override, which is explicitly what must
  be bypassed — do NOT call `resolveBaseProvider('avatar', config)`. Read
  `config.globalDefault.provider`/`config.globalDefault.model` directly instead.
- Backward compatibility: scenarios with no `avatarOverride` set must resolve identically to today
  (falling through to `defaultProfile`, then global).

# Deliverables

- `avatarOverride?: ModelProfile` added to `ScenarioModelSelection`.
- New `avatar` branch in `resolveScenarioSelection`.
- New scenario-or-global-default resolution function, exported and unit-tested.
- `readScenarioModelSelection`/`readModelProfile` round-trip all three currently-defined keys
  (`defaultProfile`, `gameMasterOverride`, `memoryOverride`) plus the new `avatarOverride`.
- Unit tests covering: scenario with `avatarOverride` set wins over `defaultProfile` for role
  `avatar`; scenario without `avatarOverride` falls back to `defaultProfile`; the new
  scenario-or-global-default function ignores `config.roleOverrides.avatar` entirely even when set;
  a Postgres write-then-read round trip preserving `memoryOverride` and `avatarOverride`.

# Mandatory Pre-Implementation Check

1. Touched entities/contracts: `ScenarioModelSelection` (shared type), `ModelResolutionService`
   (domain service), the Postgres row's `model_selection` JSONB column.
2. Search for other local copies of the `ScenarioModelSelection` shape (e.g. inline object literals
   typed ad hoc in admin code) — none expected based on prior research (DTOs re-export the shared
   type), but verify before coding. Also search for any other read path that enumerates
   `ScenarioModelSelection` fields by hand besides the Postgres repository.
3. Canonical owner: `packages/shared/src/model-catalog.ts` for the type,
   `model-resolution.service.ts` for resolution logic — confirmed existing owners, no new ones
   needed.
4. Reuse `ModelProfile` for the new field's type rather than inlining `{ provider, model }` again;
   reuse the existing `readModelProfile` helper for the repository fix.
5. N/A — canonical owners already exist.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — verify it doesn't need a mention (likely not, since precedence detail
  lives in `API_CONTRACT.md`, handled in prompt `04`).
- `docs/DATA_MODEL.md` — verify the model-configuration row description still accurately reflects
  persisted fields; update if it enumerates fields explicitly.
- Confirm `docs/API_CONTRACT.md` is now out of date (it will be — leave the actual rewrite to
  prompt `04`, but note in your commit/PR description that it needs updating).

If no doc changes are needed at this step, explicitly state that docs were reviewed and the full
rewrite is deferred to prompt `04` by design.

# Acceptance Criteria

- [ ] `ScenarioModelSelection` has `avatarOverride?: ModelProfile`
- [ ] `resolveScenarioSelection` returns `avatarOverride ?? defaultProfile` for role `avatar`
- [ ] New scenario-or-global-default function exists, exported, ignores all per-role/entity/
      request/session overrides
- [ ] `memoryOverride` and `avatarOverride` survive a Postgres write-then-read round trip for a
      scenario; existing scenarios without them persisted continue to read back without error
- [ ] Unit tests pass for the resolver branch, the new function, and the repository round trip
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
- [ ] Docs reviewed per above
