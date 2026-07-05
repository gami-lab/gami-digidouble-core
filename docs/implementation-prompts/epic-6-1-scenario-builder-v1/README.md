# EPIC 6.1 — Scenario Builder v1

## Objective

Deliver a dedicated admin application that lets operators create and maintain production scenarios without seeding-script-only workflows. The app must cover scenario setup, avatar authoring, knowledge source management (text + file upload) with visibility rules, and runtime model assignment for Avatar, Game Master, and scenario defaults.

## Generated

2026-07-05

## Dependencies Between Prompts

- `00-contract-cleanup.md` is mandatory before any feature slice.
- `01-admin-app-foundation.md` must complete before editor workflows.
- `02-scenario-and-avatar-editors.md` depends on 00 + 01.
- `03-knowledge-sources-and-visibility.md` depends on 00 + 01 and reuses scenario/avatar ownership from 02.
- `04-runtime-model-selection.md` depends on 00 + 01 and integrates with entities from 02.
- `05-tests-doc-sync-hardening.md` depends on all previous slices.

## Ordered Execution List

1. `00-contract-cleanup.md`
2. `01-admin-app-foundation.md`
3. `02-scenario-and-avatar-editors.md`
4. `03-knowledge-sources-and-visibility.md`
5. `04-runtime-model-selection.md`
6. `05-tests-doc-sync-hardening.md`

## Suggested Execution Order

Execute strictly in numeric order. Each prompt establishes contracts and module boundaries needed by later prompts.

## Definition of Done (Full EPIC)

- [ ] A dedicated admin app exists as a first-class workspace app (separate from user-facing web app).
- [ ] Admin can create/update scenarios including objectives and world context.
- [ ] Admin can create/update avatars for a scenario, including `personaPrompt` and initial visibility.
- [ ] Admin can create/update knowledge sources via pasted text and PDF/TXT upload.
- [ ] Knowledge source ownership and visibility are supported for avatar-scoped and world-scoped data, including GM-only world visibility.
- [ ] Admin can configure runtime model selection for avatar, GM, and scenario-level defaults.
- [ ] Manual admin workflows can fully replace or update current seeding-script content.
- [ ] Any new API endpoint includes a matching `*.stack-e2e.test.ts` file with auth, validation, and not-found coverage.
- [ ] Documentation is updated (`docs/PROJECT_STATUS.md` required, plus impacted contracts/architecture/data model/testing docs).
