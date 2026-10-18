# Title

Author Scenario And Character Presentation In Admin

# Context

The guided player needs authored content: what the landing says, what the visitor is asked first,
and how each character introduces itself. Authors must set this without code changes. This slice
adds the fields to the admin scenario and avatar forms on top of the contract from `00`.

# Scope

Implement now:

- scenario form (`apps/admin/src/scenarios/`): cover image URL, tagline, entry question (text +
  persona field it fills), outro text
- avatar form (`ScenarioAvatarForms.tsx`): portrait image URL, one-line hook, up to three starter
  questions (add/remove/reorder)
- inline previews: cover and portrait thumbnails, a character-card preview matching the player card
- client-side limits mirroring the shared contract, with server errors still shown
- clear/empty handling consistent with the update semantics from `00`
- seed or fixture data for the AVA scenario so the player can be developed against real content

Out of scope:

- media upload or library (EPIC 12.3)
- player screens

# Relevant Docs

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md` (12.2)

# Implementation Guidance

- Reuse the shared presentation types; do not redeclare them in `apps/admin/src/api/scenarios.ts`.
- Group the new inputs in a "Player presentation" section so authoring fields for prompts and
  runtime stay visually separate.
- Limits (lengths, max starter questions) come from one exported constant in shared, used by both
  the Core schema and the admin form.
- Tests: form behavior tests (add/remove starter questions, max 3, clearing), API client round trip,
  and a route/stack-e2e assertion that saved presentation is returned on the player's public
  projection (round trip admin → player).

# Constraints

- Admin uses the 12.1 admin session; no new auth handling.
- No media storage; URLs only.
- Keep changes inside the existing form components unless a component exceeds lint size limits.

# Deliverables

- admin scenario and avatar presentation fields with previews
- shared limit constants
- AVA presentation seed/fixture
- behavior and round-trip tests

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (Scenario/Avatar admin DTOs, form state types).
2. Search for duplicated type definitions in `apps/admin/src`.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/TEST_COVERAGE_PLAN.md` if new admin behavior tests are tracked there

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] All presentation fields are editable, clearable, and validated in admin.
- [ ] Starter questions and portraits round-trip from admin to the player projection (tested).
- [ ] AVA has authored presentation data available for development.
- [ ] Documentation reviewed and updated.
