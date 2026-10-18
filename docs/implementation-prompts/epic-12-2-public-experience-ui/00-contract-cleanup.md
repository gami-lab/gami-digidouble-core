# Title

Give Scenario And Avatar Presentation One Typed Contract

# Context

12.2 stores all player presentation in scenario and avatar `uiHints`. Today `uiHints` is an untyped
`Record<string, unknown>` buried in config (`scenario.types.ts`, `avatar.fixtures.ts`), not exposed
on any shared DTO, and not projected to the player. Building admin fields and player screens on an
untyped bag would spread ad-hoc casts across admin, web, and Core. This slice defines the contract
once before feature work.

# Scope

Implement now:

- shared types in `packages/shared/src/` (new `presentation-contract-types.ts` or the existing
  entity owner):
  - `ScenarioPresentation`: `coverImageUrl?`, `tagline?`, `entryQuestion?` (prompt text and which
    persona field the answer fills), `outroText?`
  - `AvatarPresentation`: `portraitImageUrl?`, `hook?`, `starterQuestions?` (max 3)
- Core: typed domain counterparts, validation at the API boundary (lengths, URL format, max 3
  starter questions, unknown keys rejected), mapping to/from the persisted `uiHints` section
- create/update request DTOs and admin responses carry `presentation`
- public projections (`ScenarioSummary` used by the player catalogue, `AvailableAvatarSummary`)
  carry `presentation` and nothing else from config
- remove the untyped `uiHints` access paths and fixture keys that no longer fit (e.g.
  `accentColor`, unless it becomes a typed field with a real use)
- confirm Core orchestration (Avatar prompt assembly, GM, retrieval) never reads presentation

Out of scope:

- admin form fields (prompt `01`), player screens (prompts `02`–`04`)
- media storage or slots (EPIC 12.3)

# Relevant Docs

- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/EPICS.md` (12.2, 12.3 boundary)

# Implementation Guidance

- Follow the `voiceConfig` precedent from EPIC 9.2 (`voice-contract-types.ts`,
  `voice-configuration-schema.ts`): a typed shared contract, a route schema, and a mapper over the
  extensible config column.
- Search before adding: `rg "uiHints|tagline|portrait|starterQuestion" apps packages tools` and
  check `apps/web`/`apps/admin` for local scenario/avatar shape copies.
- Keep image fields as URLs for now. Name them so 12.3 can replace the URL with a media-asset
  reference without renaming the concept (e.g. one `portrait` field whose value type changes later).
- Clearing semantics: define how a field is cleared on update and test it, matching the existing
  update conventions.
- Tests: schema validation (limits, unknown keys), mapper round trip, public projection contains
  presentation and no other config, orchestration ignores presentation.

# Constraints

- One canonical owner per type; no duplicated presentation shapes in clients.
- No new table; presentation lives in the existing `uiHints` config section.
- No migration or compatibility path (database is recreated per deploy).

# Deliverables

- shared presentation contract and exports
- Core validation, domain types, mapping, and projection changes
- updated request/response DTOs
- unit and route tests listed above

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (Scenario, Avatar, `AvailableAvatarSummary`, admin DTOs).
2. Search for duplicated type definitions and inline response shapes in web, admin, console.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/DATA_MODEL.md` (`uiHints` presentation section)
- `docs/API_CONTRACT.md` (canonical owner, public projection fields)

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Presentation is typed end to end with one shared owner.
- [ ] Invalid presentation input returns `400 VALIDATION_ERROR`.
- [ ] Player projections expose presentation and no other config.
- [ ] Core orchestration does not read presentation (tested or asserted by structure).
- [ ] Documentation reviewed and updated.
