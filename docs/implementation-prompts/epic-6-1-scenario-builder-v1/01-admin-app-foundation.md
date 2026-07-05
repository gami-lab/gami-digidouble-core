# Admin App Foundation and Vertical Skeleton

## Context

EPIC 6.1 requires a dedicated admin experience, distinct from player-facing web UX and from debugging-focused console surfaces. This slice creates the new admin app and wires a minimal end-to-end path so later feature prompts can ship quickly.

## Scope

In scope:

- scaffold a dedicated admin application in the monorepo
- wire routing, API client integration, auth key handling strategy for admin workflows
- implement minimal layout/navigation for scenario-builder modules
- add a first vertical skeleton flow (list scenarios + open detail shell)
- establish shared UI/state patterns used by subsequent prompts

Out of scope:

- full scenario/avatar/knowledge/model editing behavior
- broad visual redesign of unrelated apps

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Create a new app workspace (for example `apps/admin`) as a first-class app, not a mode inside `apps/web`.
- Keep the app headless-core compliant: UI consumes APIs only; business logic remains in core modules.
- Reuse canonical shared contracts and API client helpers from prompt 00.
- Build only what future prompts need:
  - app shell
  - scenario navigation
  - scenario list fetch + loading/error states
  - scenario detail placeholder route
- Align with existing repo conventions for scripts, build, test, and lint integration.

If new admin endpoints are introduced in this slice, create matching stack-e2e tests at:

- `apps/core/src/api/routes/<route-name>.stack-e2e.test.ts`

and include at minimum:

- auth enforcement (`401` missing/wrong API key)
- schema validation (`400` invalid payload)
- resource-not-found (`404` + correct `ApiResponse` error code when relevant)

## Constraints

Respect:

- architecture boundaries
- KISS, YAGNI, DRY
- no contract duplication
- backward compatibility for existing routes/clients

## Deliverables

- new admin app workspace integrated into monorepo commands
- admin shell + route structure for scenario-builder features
- scenario list vertical skeleton connected to API
- tests for new app baseline and touched integrations

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/ARCHITECTURE.md` (new app/module wiring)
- `docs/TECH_STACK.md` (if tooling/workspace config changed)

If no doc changes are needed, explicitly confirm docs remain accurate.

## Acceptance Criteria

- [ ] dedicated admin app exists and runs locally through workspace scripts
- [ ] scenario list skeleton works end-to-end in admin app
- [ ] no shared DTO duplication is introduced
- [ ] any new endpoint from this slice has stack-e2e coverage
- [ ] required documentation review/update completed
