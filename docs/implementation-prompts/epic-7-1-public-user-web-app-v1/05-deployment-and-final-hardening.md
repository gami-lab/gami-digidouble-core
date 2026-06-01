# Deployment and Final Hardening

## Context

This optional follow-up slice is for the final packaging pass once the public web app works end-to-end. Use it only if the implementation reveals a deployment or build integration gap that must be closed before production use.

## Scope

Finalize the web app’s production readiness.

In scope:

- verify the web app build is compatible with the monorepo and Coolify deployment model
- ensure the app uses production-safe environment variables
- check routing, asset loading, and browser refresh behavior
- confirm the debug console remains excluded from Coolify production deployment
- perform a final review of docs and status files

Out of scope:

- new product features
- major UI redesigns
- unrelated backend changes

## Relevant Docs

- `docs/COOLIFY_DEPLOYMENT_SPECIFICATION.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `docs/TECH_STACK.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`

## Implementation Guidance

- Make sure the web app build/deploy story is explicit and repeatable.
- Keep the deployment path separate from the debug console.
- If the deployment model needs a new doc clarification, add it now rather than leaving ambiguity for the next EPIC.
- Confirm the web app’s runtime contract remains stable across refresh and rebuild.

## Constraints

Respect the current architecture, KISS, YAGNI, DRY, and backward compatibility. Do not introduce deployment complexity that is not required by the product surface.

## Deliverables

- final production-readiness checks for `apps/web`
- deployment assumptions documented
- confirmation that `apps/console` is not part of production routing

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
- any outdated impacted docs

If deployment assumptions or production routing changed, update the relevant docs before closing the slice.

## Acceptance Criteria

- [ ] the web app build is compatible with the monorepo
- [ ] production environment variables are documented and stable
- [ ] the debug console remains excluded from Coolify production deployment
- [ ] refresh/load behavior is explicitly verified
- [ ] docs are updated where needed
