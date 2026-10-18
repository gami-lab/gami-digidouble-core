# EPIC 12.1 — Two-Tier Route Security

## Objective

Give public player routes and admin routes different security levels so the platform can be
exposed publicly without exposing authoring or other users' data. Every route declares a tier,
admins sign in for real, players receive a short-lived Core-issued token that carries their user
identity, and no secret ships in any browser bundle.

## Generated

2026-10-18

## Baseline

- One `API_KEY_SECRET` (`x-api-key`) protects every route. `docker-compose.coolify.yml` passes it
  to both the `web` and `admin` builds as `VITE_API_KEY`, so the full-power key is public
  JavaScript. `apps/console` and `tools/conversation-evaluation` use the same key.
- `authenticateApiKey` (`apps/core/src/api/hooks/authenticate.ts`) is attached route-by-route,
  inconsistently: `preHandler` in most plugins, `preValidation` in `knowledge.ts`, `onRequest` in
  `conversation-message-audio.ts`, per-route in `exchange.ts` and `voice-messages.ts`.
- Authoring CRUD (`/v1/scenarios*`, `/v1/avatars*`, `/v1/knowledge-sources*`,
  `/v1/ingestion-jobs*`, `prepare-avatar-traits`) is not under `/v1/admin`.
- `userId` is chosen by the browser (`apps/web/src/identity/local-identity.ts`) and sent in
  `POST /v1/sessions` and `PUT /v1/users/{userId}/persona`; nothing checks that a session or
  conversation belongs to the caller.
- `AvailableAvatarSummary` exposes `personaPrompt` to the player.
- nginx serves the admin SPA at `/admin` (`infra/nginx/admin.conf`) with no sign-in.
- CORS is one global `config.corsOrigin`; there are no rate limits; only voice routes set body limits.

## Design Decisions

- **Tiers:** `public` (player token), `admin` (admin session cookie or server-side service key),
  and `open` for the few routes that must work without a credential (`GET /health`, player token
  issue, admin login; all rate-limited except health). The tier is declared in one
  place per route plugin and enforced by one shared hook, not by per-file `addHook` calls.
- **Admin sign-in:** a single operator password (hashed in Core env) → `POST /v1/admin/auth/login`
  sets an `HttpOnly`, `Secure`, `SameSite` session cookie backed by Redis. OIDC is out of scope;
  keep the session store behind a port so OIDC can replace the password check later.
- **Service key:** `tools/conversation-evaluation` and local `apps/console` runs authenticate admin
  routes with a server-side `ADMIN_SERVICE_KEY` header. It never enters a Vite build.
- **Player token:** `POST /v1/auth/player` (public, rate-limited, no credential) returns a
  Core-generated `userId` and an HMAC-signed token with a short TTL plus a refresh path. Use
  `node:crypto`; do not add a JWT/OIDC dependency without measured need.
- **Ownership:** public routes derive `userId` from the token, never from the body/path/query.
  A session or conversation owned by another user returns `404 NOT_FOUND` (not 403) so ids do not
  leak existence. Player tokens on admin routes return `403 FORBIDDEN`.
- Breaking API changes are allowed (prototype rule in `AGENTS.md`): move routes, drop `userId`
  from public request bodies, and update every client in the same change. No aliases.

## Ordered Execution List

| #   | File                                      | Purpose                                                                                |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| 0   | `00-contract-cleanup.md`                  | One auth hook entry point; trim public projections; inventory every route and caller   |
| 1   | `01-route-tiers-and-admin-prefix.md`      | Declare a tier on every route, move authoring CRUD under `/v1/admin`, tier-matrix test |
| 2   | `02-admin-sign-in.md`                     | Admin login/logout/session cookie, service key, admin SPA login screen                 |
| 3   | `03-player-token-and-ownership.md`        | Core-issued player token, token-derived `userId`, ownership checks on sessions/history |
| 4   | `04-rate-limits-body-limits-and-cors.md`  | Rate limits and body limits on message/voice routes, CORS per tier                     |
| 5   | `05-deployment-hardening-and-doc-sync.md` | Remove secrets from bundles, compose/nginx, client migration audit, full doc sync      |

## Dependencies And Suggested Order

Run in order: `00 -> 01 -> 02 -> 03 -> 04 -> 05`.

- `01` needs the single auth entry point and route inventory from `00`.
- `02` and `03` both plug credentials into the tier hook from `01`. `02` lands first so the admin
  SPA, console, and evaluation tool keep working when the shared key stops being accepted.
- `04` needs tiers (`01`) and token identity (`03`) to key rate limits per player.
- `05` runs last: it removes `VITE_API_KEY` everywhere and only then may the EPIC be marked done.

## Definition Of Done For The Full EPIC

- [ ] Every registered route declares exactly one tier; a CI test fails on an untagged route.
- [ ] Authoring CRUD lives under `/v1/admin/*`; public routes are only player-facing.
- [ ] Admin UI and every admin route require a sign-in (or the server-side service key).
- [ ] A player token receives `403` on every admin route.
- [ ] Public routes derive `userId` from the token; another user's session, conversation, history,
      runtime state, events stream, or audio returns `404`.
- [ ] Public projections expose no authoring internals (`personaPrompt`, raw `config`).
- [ ] Rate limits trigger (`429 RATE_LIMITED`) on token issue, message, and voice routes; body
      limits reject oversized payloads.
- [ ] CORS is configured per tier: the player origin cannot call admin routes with credentials.
- [ ] The built `web`, `admin`, and `console` bundles contain no secret (`VITE_API_KEY` removed).
- [ ] `apps/web`, `apps/admin`, `apps/console`, and `tools/conversation-evaluation` work against
      the new contract.
- [ ] Stack-e2e coverage exists for every new endpoint (auth, validation, not-found).
- [ ] `docs/PROJECT_STATUS.md`, `docs/API_CONTRACT.md`, `docs/ARCHITECTURE.md`,
      `docs/DATA_MODEL.md`, `docs/TECH_STACK.md`, `docs/TEST_STRATEGY.md`,
      `docs/TEST_COVERAGE_PLAN.md`, and `docs/EPICS.md` are synchronized.
