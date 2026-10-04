# Scenario Admin UI Symmetry, Hardening & Documentation Sync

# Context

With the API accepting `avatarOverride`/`memoryOverride` (prompt `02`) and trait preparation
decoupled (prompt `03`), the scenario admin UI must expose the two new fields, and the EPIC needs a
closing documentation pass. Today, `apps/admin/src/scenarios/ScenarioEditForm.tsx` and
`apps/admin/src/scenarios/ScenarioCreatePage.tsx` only track `defaultModelSelection`/
`gameMasterModelSelection` as local state (`ScenarioEditForm.tsx` lines ~33-38), build only those
two keys on submit via `apps/admin/src/scenarios/model-selection-form.ts`'s
`toScenarioModelSelection` (lines ~48-72), and render only two `<ModelSelectionFields>` blocks via
`apps/admin/src/scenarios/ScenarioFormFields.tsx` (lines ~123-138). The reusable field component,
`apps/admin/src/scenarios/ModelSelectionFields.tsx`, is already generic
(`idPrefix`/`label`/`value`/`helperText`/`onChange`) and needs no changes. This is the last prompt
in the EPIC, so it also runs the full verification suite and brings `docs/API_CONTRACT.md`,
`docs/DATA_MODEL.md`, `docs/PROJECT_STATUS.md`, and `docs/EPICS.md` back in sync with everything
shipped in prompts `01`-`03`.

# Scope

In scope:

- `model-selection-form.ts`: extend `fromScenarioModelSelection` and `toScenarioModelSelection` to
  read/write `avatarOverride`/`memoryOverride`, mirroring the existing two keys exactly.
- `ScenarioFormFieldsProps`/`ScenarioFormFields.tsx`: add `avatarModelSelection`/
  `memoryModelSelection` props and `onAvatarModelSelectionChange`/`onMemoryModelSelectionChange`
  callbacks, and two more `<ModelSelectionFields>` blocks ("Avatar override" and "Memory
  override"), following the exact `idPrefix`/`label`/`helperText` pattern used for "Scenario
  default model"/"Game Master override". Field order: Default, Avatar, Game Master, Memory —
  matching the global `ModelConfigPage.tsx`'s `ROLE_KEYS` ordering for a consistent mental model
  between the two config surfaces.
- `ScenarioEditForm.tsx`: add the two new pieces of local state, wire them into
  `toScenarioModelSelection` on submit, pass them down to `ScenarioFormFields`, and extend
  `hasPartialModelSelectionState` (~lines 68-70) to cover them.
- `ScenarioCreatePage.tsx`: mirror the identical treatment (confirmed parallel structure at lines
  ~27-28, 37-39, 61-64, 80-81, 90-91).
- Extend whatever component tests already exist for `ScenarioEditForm`/`model-selection-form`
  (e.g. `model-selection-form.test.ts`) to cover the two new fields.
- Run the full `pnpm lint`, `pnpm typecheck`, `pnpm test` suite and fix any issue surfaced only
  once all of prompts `01`-`03`'s changes are combined.
- Rewrite `docs/API_CONTRACT.md`'s scenario model selection precedence section (~lines 160-168) to
  reflect: the four-slot scenario shape, the now fully-wired `memoryOverride` precedence, the new
  `avatarOverride` precedence for the `avatar` role, and the avatar-trait-preparation resolution
  rule (scenario default → global default, independent of role overrides) documented next to the
  `/prepare-avatar-traits` endpoint.
- Update `docs/DATA_MODEL.md`'s model-configuration row (~line 28) with a short symmetry note if
  useful.
- Update `docs/PROJECT_STATUS.md` to reflect the shipped capability.
- Mark `4.1d` as `✅ Done` in `docs/EPICS.md`'s Shipped EPICS section (moving it out of Open
  Backlog), following the one-paragraph summary style used for `4.1c`.
- A final grep for `gameMasterOverride`/`memoryOverride` across code, tests, and docs to confirm
  every call site has a matching `avatarOverride` counterpart where appropriate.

Out of scope:

- `ModelSelectionFields.tsx` itself — already generic, no changes needed.
- Refactoring the scenario form into the global `ModelConfigPage.tsx`'s data-driven `ROLE_KEYS`
  style — the scenario form's explicit-field style is the lower-risk match for 4 fields; flag a
  data-driven refactor as a follow-up suggestion rather than doing it inline here.
- Any new functional change beyond minimal gap-fixes discovered while running the full suite.

# Relevant Docs

- `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/PROJECT_STATUS.md`, `docs/EPICS.md` — all
  four are edited by this prompt.

# Implementation Guidance

- Copy the exact label/helperText conventions already used for "Scenario default model" and "Game
  Master override" in `ScenarioFormFields.tsx`; write analogous copy for "Avatar override"
  (clarify it governs live avatar conversation turns, not trait preparation — this distinction
  matters given prompt `03`'s decoupling) and "Memory override".
- `hasPartialModelSelectionState` currently guards against submitting a half-filled override (e.g.
  provider chosen but no model). Extend its logic identically for the two new fields.
- For the `docs/EPICS.md` update, follow the exact format of the `4.1c` shipped entry: a
  `#### \`4.1d Scenario Model Config Symmetry\` ✅ Done`heading with one summary paragraph, placed
in the "Orchestration, Memory, And Runtime State" theme section right after`4.1c`, and remove
  the corresponding Open Backlog entry.
- When rewriting `API_CONTRACT.md`'s precedence text, keep the existing per-role prose style
  (`Avatar: ... -> ... -> ...; GM: ...; Memory: ...`) and add a parallel sentence for avatar trait
  preparation's independent resolution path, making clear it is NOT part of the `avatar` role's
  precedence chain.

# Constraints

- DRY: for 4 total fields, prefer matching the existing explicit-field style over introducing a new
  role-keyed loop pattern.
- Backward compatibility: scenarios without `avatarOverride`/`memoryOverride` set must show those
  fields as empty/unset in the edit form, not throw or show stale data.
- Documentation must precisely describe the implemented precedence — do not describe aspirational
  behavior that wasn't actually built.

# Deliverables

- Scenario create and edit forms expose all four model selection slots (Default, Avatar, Game
  Master, Memory); `model-selection-form.ts` round-trips all four fields.
- Updated component tests.
- Full suite green.
- `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/PROJECT_STATUS.md`, `docs/EPICS.md` all
  updated and internally consistent with the shipped code.

# Mandatory Pre-Implementation Check

1. Touched entities/contracts: admin-side form state and the `CreateScenarioRequest`/
   `UpdateScenarioRequest` DTOs (already type-complete and exercised via the API from prompt `02`).
2. Search for any other admin surface duplicating scenario model selection UI (e.g. a read-only
   scenario detail view) — update for consistency if found, or confirm it already renders whatever
   `modelSelection` fields are present generically.
3. Canonical owner of the form-to-DTO mapping: `model-selection-form.ts` — reuse it, don't duplicate
   mapping logic inline in either page component.
4. Reuse `ModelSelectionFields.tsx` as-is.
5. N/A.

# Mandatory Final Step — Documentation Update

This prompt's own deliverables include the documentation update — treat the "Deliverables" section
above as this step. Re-read `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/PROJECT_STATUS.md`,
and `docs/EPICS.md` once more end to end after editing, for internal consistency with the shipped
behavior.

# Acceptance Criteria

- [ ] Scenario create and edit forms both expose Avatar and Memory override fields alongside the
      existing Default and Game Master fields
- [ ] `model-selection-form.ts` reads/writes all four fields symmetrically
- [ ] `hasPartialModelSelectionState` covers all four fields
- [ ] Component tests pass for the new fields
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass for the full repo
- [ ] `docs/API_CONTRACT.md` precedence section accurately describes the four-slot scenario shape
      and the decoupled avatar-trait-preparation path
- [ ] `docs/DATA_MODEL.md` and `docs/PROJECT_STATUS.md` reflect the shipped capability
- [ ] `docs/EPICS.md` moves `4.1d` from Open Backlog to Shipped EPICS with a one-paragraph summary
- [ ] No stray two-slot-only references remain in code comments or docs
