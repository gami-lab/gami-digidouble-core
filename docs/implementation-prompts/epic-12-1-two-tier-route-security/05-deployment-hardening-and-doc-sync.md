# Title

Remove Secrets From Bundles, Harden Deployment, And Sync Docs

# Context

Credentials now work end to end (prompts `02`–`04`), but the build pipeline still injects
`API_KEY_SECRET` into the `web` and `admin` images as `VITE_API_KEY`, and the old shared key may
still be accepted somewhere. This slice removes the legacy key entirely, verifies the built
bundles, and closes the EPIC.

# Scope

Implement now:

- delete `VITE_API_KEY` from `apps/web`, `apps/admin`, `apps/console` env modules, `vite-env.d.ts`,
  Dockerfiles, `docker-compose*.yml`, and `.env.example`; delete `shouldInjectApiKey` and
  `x-api-key` handling from `packages/shared/src/api-client-protocol.ts` if nothing uses them
- remove `API_KEY_SECRET` from Core config and the old `authenticateApiKey` verifier, unless it has
  become the `ADMIN_SERVICE_KEY` verifier under a clear name
- a CI check that greps the built `web`, `admin`, and `console` `dist/` output for known secret
  names and values-shaped strings and fails if found (reuse existing CI scripts where possible)
- `infra/nginx/admin.conf`: the SPA itself is static and contains no secret, so login lives in the
  app; add security headers (CSP suitable for the SPA, `X-Frame-Options`/`frame-ancestors`,
  `Referrer-Policy`) to both nginx configs
- full regression: player flow, admin flow, console against local stack, evaluation tool run
- audit: tier matrix passes, every new endpoint has a stack-e2e file, no TODO left in code

Out of scope:

- OIDC, player accounts, infrastructure changes beyond compose/nginx/Dockerfiles

# Relevant Docs

- `docs/TECH_STACK.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`, `docs/EPICS.md`

# Implementation Guidance

- Start with `rg "VITE_API_KEY|API_KEY_SECRET|x-api-key|shouldInjectApiKey"` across the repo
  (excluding `dist`, `coverage`, `node_modules`) and drive it to zero, except the renamed service key.
- Coolify env: list the variables an operator must set/remove after deploy (admin password hash,
  cookie secret, player token secret, service key, origins). Put the list in the deployment section
  of the existing doc that already describes Coolify, not in a new file.
- Run `pnpm` format, lint, typecheck, test, build, and the stack-e2e suite; record anything skipped.

# Constraints

- No compatibility path for the old key (prototype rule).
- Comment policy applies: no comments narrating the migration.

# Deliverables

- no secret in any frontend build input or output; CI check enforcing it
- legacy shared-key path removed
- nginx security headers
- full regression evidence and synchronized docs

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (client protocol helpers, config schema, compose files).
2. Search for duplicated env readers across `apps/*/src/env.ts`.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (12.1 shipped)
- `docs/EPICS.md` (12.1 marked done with a short shipped summary)
- `docs/API_CONTRACT.md` (base rules: authentication no longer `x-api-key`)
- `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Built `web`, `admin`, and `console` bundles contain no secret; CI enforces it.
- [ ] `API_KEY_SECRET`/`VITE_API_KEY` are gone from code, compose, Dockerfiles, and env examples.
- [ ] Admin UI and admin routes require login; player tokens get 403 there.
- [ ] Another user's session or conversation returns 404.
- [ ] Rate limits trigger on message and voice routes.
- [ ] Full checks and stack-e2e pass; operator env changes are documented.
- [ ] All impacted docs are synchronized and 12.1 is marked done.
