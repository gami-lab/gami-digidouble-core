# Title

Declare A Tier On Every Route And Move Authoring Under `/v1/admin`

# Context

The security boundary must be visible in code and enforced by CI, not remembered. Today public
player routes and authoring CRUD share prefixes (`/v1/scenarios`, `/v1/avatars`,
`/v1/knowledge-sources`), so a proxy or CORS rule cannot separate them. This slice makes the split
structural; credentials still use the existing API key until prompts `02` and `03`.

# Scope

Implement now:

- a route-tier declaration (`public` | `admin` | `open`) on every route, set in route config/options
  and read by the single auth hook from `00`
- the hook refuses to serve a route with no tier (fail closed at startup, not per request)
- move authoring routes under `/v1/admin`:
  - scenario create/update/delete, avatar create/update/delete, `prepare-avatar-traits`
  - all knowledge-source, upload, ingest, ingestion-job, and chunk routes
  - `POST /v1/exchange` (operator/evaluation tool, not a player route)
  - cross-user session listing (`GET /v1/sessions?scenarioId=` as used by `apps/console`)
- keep a read-only public catalogue for the player: active scenarios and active avatars only,
  through the public projections from `00`
- update `apps/admin`, `apps/console`, and `tools/conversation-evaluation` clients and their
  `shouldInjectApiKey` path logic in `packages/shared/src/api-client-protocol.ts`
- a route-tier matrix test that enumerates registered routes (Fastify `onRoute`) and fails when a
  route has no tier or a `/v1/admin/*` route is not `admin`

Out of scope:

- new credentials, player token, ownership checks (prompts `02`, `03`)
- removing `VITE_API_KEY` (prompt `05`)

# Relevant Docs

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md` (12.1)

# Implementation Guidance

- Register moved plugins with `prefix: '/v1/admin'` in `apps/core/src/api/server.ts`; keep handlers
  and use cases unchanged. Rename route files only if the name becomes misleading.
- Public catalogue: either a dedicated small public route plugin or the existing scenarios plugin
  split into public read and admin write. Choose the version with less duplication; the public read
  must filter to `status: 'active'`.
- Move and rename existing stack-e2e tests with their routes (`scenarios.stack-e2e.test.ts`,
  `avatars.stack-e2e.test.ts`, `knowledge.stack-e2e.test.ts`, `exchange.stack-e2e.test.ts`).
- The tier matrix test belongs next to `server.test.ts`. It must build the real server via
  `createServer` so newly added plugins are covered automatically.
- No compatibility aliases for old paths (prototype rule).

# Constraints

- Handlers, use cases, and domain logic do not change; this is a routing/boundary slice.
- One declaration per route; no parallel allowlist file that can drift.
- Every external input stays validated at the API boundary.

# Deliverables

- tier declared on every route; startup failure on a missing tier
- authoring routes under `/v1/admin/*`; public read-only catalogue for active content
- updated admin, console, evaluation-tool clients and shared path helpers
- `route-tiers.test.ts` (or equivalent) tier matrix test
- moved/updated stack-e2e and route tests

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (Scenario, Avatar, Knowledge DTOs, client path helpers).
2. Search for duplicated path strings and request helpers across `apps/*/src/api` and tools.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` (route list split into public / admin / open, tier rule)
- `docs/ARCHITECTURE.md` (route tier boundary)
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` (tier matrix test)

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Every registered route has exactly one tier; the matrix test fails CI on an untagged route.
- [ ] No authoring route remains outside `/v1/admin`.
- [ ] The public catalogue returns only active scenarios/avatars via public projections.
- [ ] Admin, console, and evaluation-tool flows work against the new paths.
- [ ] Moved stack-e2e tests still cover auth, validation, and not-found.
- [ ] Documentation reviewed and updated.
