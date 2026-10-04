# EPIC 4.1d — Scenario Model Config Symmetry

## Objective

Make scenario-level model configuration structurally symmetric with the global level (default +
`avatar`/`gameMaster`/`memory` overrides, matching the four-slot shape already shipped globally in
`4.1c`), and decouple one-time avatar trait preparation from the `avatar` role so it resolves
against the scenario/global default instead of sharing a model tier with live conversation turns.

**Generated:** 2026-10-04

---

## Ordered Execution List

| #   | File                                 | Title                                                               | Depends On |
| --- | ------------------------------------ | ------------------------------------------------------------------- | ---------- |
| 01  | `01-shared-type-and-resolver.md`     | Scenario `avatarOverride` Type, Resolver Precedence & Read-Path Fix | —          |
| 02  | `02-admin-api-plumbing.md`           | Admin API Validation, Mapping & Schema Parity                       | 01         |
| 03  | `03-avatar-trait-prep-decoupling.md` | Decouple Avatar Trait Preparation From Avatar Role                  | 01         |
| 04  | `04-admin-ui-and-docs.md`            | Scenario Admin UI Symmetry, Hardening & Documentation Sync          | 02, 03     |

This is a small, mostly mechanical mirroring EPIC (repeat a 2-field pattern across 4 layers) rather
than a deeply complex one, so it's kept to 4 prompts instead of the full 3-7 range.

---

## Dependencies Between Prompts

- **01** adds `avatarOverride` to the shared `ScenarioModelSelection` type, wires the new branch
  into `ModelResolutionService.resolveScenarioSelection`, introduces the scenario/global-default-only
  resolution primitive needed by `03`, and — while in the same files — fixes a pre-existing bug
  where the Postgres scenario read path silently drops the already-shipped `memoryOverride` field
  on every read-back. No reason to split the bugfix into its own prompt; it's the same
  files/contract surface.
- **02** depends on `01` for the type. Wires `avatarOverride` and `memoryOverride` through the
  admin API: mappers, validators, Fastify JSON schemas (both create and update routes), and
  stack-e2e coverage.
- **03** depends on `01` for the new resolution primitive. Changes avatar trait preparation to stop
  using `role: 'avatar'` (which pulls in the Avatar entity's own `llmOverride` and the global avatar
  role override) and instead resolve via scenario default → global default only.
- **04** depends on `02` (stable API shapes before building UI) and `03` (so the UI's "Avatar
  override" field copy can correctly describe what it does and does not affect). Mirrors the
  existing Default/Game Master override fields onto Avatar/Memory in the scenario create/edit
  admin forms, then runs the full verification suite and syncs all affected docs — including
  marking `4.1d` `✅ Done` in `docs/EPICS.md`.

---

## Definition of Done (Full EPIC)

- [ ] Postgres scenario read path (`readScenarioModelSelection`) restores `memoryOverride` (and the
      new `avatarOverride`) instead of silently dropping fields not explicitly enumerated
- [ ] `ScenarioModelSelection` (shared type) has `avatarOverride`, matching
      `gameMasterOverride`/`memoryOverride`
- [ ] `ModelResolutionService.resolveScenarioSelection` resolves `avatarOverride ?? defaultProfile`
      for the `avatar` role, mirroring the existing `gameMaster`/`memory` branches
- [ ] A scenario/global-default-only resolution path exists and is used by avatar trait
      preparation, bypassing `config.roleOverrides.avatar`, the Avatar entity's own `llmOverride`,
      and the new scenario `avatarOverride`
- [ ] Admin API (`POST /v1/scenarios`, `PATCH /v1/scenarios/:id`) accepts, validates, and persists
      `avatarOverride`/`memoryOverride` end-to-end (schema, mapper, validator, Postgres write+read)
- [ ] Scenario create/edit admin forms expose Avatar and Memory override fields, matching the
      existing Default/Game Master UX
- [ ] Existing scenarios/avatars with no new overrides set resolve unchanged (backward-compatible)
- [ ] `apps/core/src/api/routes/scenarios.stack-e2e.test.ts` covers `avatarOverride`/`memoryOverride`
      round-tripping and validation
- [ ] Unit tests cover the resolver's new branch and the scenario-default-only resolution path
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
- [ ] `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/PROJECT_STATUS.md`, `docs/EPICS.md` updated
