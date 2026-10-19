# Code Audit — EPIC 12.1 Two-Tier Route Security

## Scope audited

EPIC 12.1 as defined by this folder's `README.md`: commits `8c802c0d..0aa7c7ab` (7 commits, one per
prompt `00`–`04`, two for `05`). 237 files changed, +6,293 / −1,718 lines.

Reviewed:

- Core auth wiring: `api/hooks/authenticate.ts`, `admin-credentials.ts`, `player-credentials.ts`,
  `api/route-tiers.ts`, `api/rate-limit.ts`, `api/cors.ts`, `api/server.ts`
- application auth: `AdminAuthService`, `PlayerTokenService`, `PlayerAccessService`, password
  hashing, `IAdminSessionStore`, `IRateLimiter`, their in-memory and Redis adapters
- new routes: `admin-auth.ts`, `player-auth.ts`, `admin-session-management.ts`,
  `scenario-catalogue.ts`, and the moved authoring, knowledge, exchange, and persona routes
- clients: web player session, admin and console sign-in, console operator player tokens, the
  evaluation tool, and the seed script
- deployment: compose files, Dockerfiles, nginx, `.env.example`, the bundle secret scanner, CI
- `API_CONTRACT.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `TECH_STACK.md`, `TEST_STRATEGY.md`,
  `TEST_COVERAGE_PLAN.md`, `PROJECT_STATUS.md`, `EPICS.md`, `COOLIFY_DEPLOYMENT_SPECIFICATION.md`

## Executive Summary

The EPIC is delivered. Every route has exactly one tier, enforced at startup and by a matrix test
built from the real server. Authoring lives under `/v1/admin`. Admins sign in with a scrypt
password and a Redis-backed `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/v1/admin`, plus
an origin check for CSRF. Players receive Core-signed HMAC tokens, and `userId` comes only from the
token. Ownership is checked in one `onRequest` hook before any body is read, so voice, audio, and SSE
work never starts for another player. Rate limits, per-tier body limits, and per-tier CORS are in
place. `VITE_API_KEY` and `API_KEY_SECRET` are gone, CI scans built bundles, and the scanner caught a
real leak: Vite was inlining the whole `import.meta.env` into the web and admin bundles.

Two real defects surfaced and were fixed along the way: SSE/voice handlers aborted their own streams
because they listened for the request's `close` event, and knowledge uploads were silently capped at
Fastify's 1 MB default despite the documented ~14 MB limit.

What keeps this from A:

1. **"Unknown fields are rejected" is not true.** Fastify's default AJV setting strips additional
   properties instead of rejecting them. A player can still send `userId` to `POST /v1/sessions`;
   it is silently dropped. Ownership is unaffected, but the contract and the "no public request
   accepts a client-chosen `userId`" guarantee read stronger than the behavior.
2. **Route tests blur the tier boundary.** `credentialHeaders()` sends a player token _and_ the
   service key on every request, so most route tests pass whichever tier the route is on. The
   matrix tests prove the boundary separately, but individual route tests no longer would catch a
   route registered on the wrong tier.
3. **Ownership relies on a parameter-naming convention** (`sessionId`, `conversationId`). Nothing
   fails if a future public route names a resource differently or takes an id in the body.
4. **Duplicated sign-in UI** in `apps/admin` and `apps/console` (`AuthGate`, `LoginPage`,
   `api/auth.ts`, the signed-out listener).

## Final Grade

**B — solid, minor debt only.**

Lint, typecheck, unit, integration, and stack suites pass. The security behaviors are proven at the
HTTP boundary, including against the real Docker stack. An A is ruled out by the gap between the
documented "unknown fields are rejected" rule and actual behavior, and by test helpers that no
longer prove tier placement per route.

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS — Core 1,288; admin 126; web 96; evaluation 88; console 33; shared 21; lint-rule
  and bundle-scanner `node:test` suites
- integration/e2e (`test:integration-e2e`): PASS — 172 passed, 3 skipped (provider-gated)
- stack-e2e (Docker): PASS — 134 passed, 8 skipped (provider-gated)
- coverage: PASS — Core 87.56% statements / 84.53% branches; new auth, tier, CORS, and rate-limit
  modules are 95–100%

## Feature Confidence Matrix

| Feature                     | Expected Behavior                                                                    | Evidence                                                        | Confidence | Notes                                                       |
| --------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| Route tiers                 | every route tagged; untagged fails startup; `/v1/admin/*` is admin                   | `route-tiers.test.ts` (real server enumeration)                 | High       |                                                             |
| Authoring under `/v1/admin` | no authoring route on the public tier                                                | matrix "public routes stay player-facing"                       | High       |                                                             |
| Auth before body            | unauthenticated voice/upload/audio rejected without reading an 11 MB body            | `server.test.ts`                                                | High       |                                                             |
| Admin sign-in               | 401 wrong password, cookie flags, expiry, logout, old key rejected                   | `admin-auth.test.ts`, `admin-auth.stack-e2e.test.ts`            | High       |                                                             |
| CSRF                        | cookie state change from a foreign or missing origin → 403                           | `admin-auth.test.ts`, stack                                     | High       |                                                             |
| Service key                 | tools authenticate without an origin                                                 | `admin-auth.test.ts`, evaluation integration test               | High       |                                                             |
| Player token                | create, refresh, tamper, wrong secret, expiry                                        | `player-token.service.test.ts`, `player-auth.stack-e2e.test.ts` | High       |                                                             |
| Ownership                   | 16 public routes answer a foreign id with the same 404 as an unknown id              | `player-auth.test.ts`, cross-player stack test                  | High       | depends on param naming (finding 3)                         |
| Player token on admin       | 403 on every admin route                                                             | matrix test                                                     | High       |                                                             |
| Client-chosen `userId`      | never used                                                                           | session/persona route tests                                     | Medium     | silently stripped, not rejected (finding 1)                 |
| Rate limits                 | 429 + `Retry-After`; per player/IP; other subject unaffected; proxy-aware; fail-open | `rate-limit.test.ts`                                            | High       | stack runs with high limits by design                       |
| Body limits                 | oversized player/open body → 400; authoring and upload limits larger                 | `cors-and-body-limits.test.ts`                                  | High       |                                                             |
| Per-tier CORS               | player origin gets no grant on admin routes; admin origin with credentials           | `cors-and-body-limits.test.ts`                                  | High       |                                                             |
| No secrets in bundles       | CI fails on secret names/values                                                      | scanner tests + CI job; real build verified                     | High       |                                                             |
| Web player identity         | Core-issued token stored, refreshed, retried once on 401                             | `player-session.test.ts`                                        | Medium     | identity/persona drift when a token is replaced (finding 6) |
| Console as owner            | operator-issued token per session owner                                              | `player.test.ts`                                                | Medium     | no stack/browser test                                       |

## Strengths

- One hook, one verifier per tier, attached at `onRequest` — the order guarantee (auth before body)
  is structural, not per-route.
- Tier is declared by scope with per-route override, so new plugins inherit a tier and body limit
  without a parallel allowlist.
- Ownership happens before parsing and covers SSE, voice, and audio uniformly; foreign and unknown
  ids are indistinguishable.
- Secrets never at rest in usable form: admin session keys are HMACs of the cookie value, IPs in
  limiter keys are hashed, tokens are never logged.
- Ports and adapters for every Redis concern (`IAdminSessionStore`, `IRateLimiter`), with
  in-memory adapters for tests; no new runtime dependency.
- The bundle scanner is tested and immediately proved its value.

## Findings

### Unknown body fields are stripped, not rejected

- Severity: High
- Category: contract drift
- Problem: Fastify's AJV default `removeAdditional: true` silently removes properties not in the
  schema, although `API_CONTRACT.md` says unknown fields are rejected.
- Why it matters: `POST /v1/sessions` with a `userId` succeeds as if the field were valid, and any
  client typo or stale field passes unnoticed.
- Evidence: a probe `POST /v1/sessions {scenarioId, userId:'other'}` reaches the use case; several
  e2e and stack tests still send `userId` and pass.
- Recommendation: set `ajv.customOptions.removeAdditional = false` and fix the stale callers.

### Route-test credentials satisfy both tiers

- Severity: Medium
- Category: test quality
- Problem: `credentialHeaders()` and `stackCredentialHeaders()` send a player token and the service
  key together.
- Why it matters: a route moved to the wrong tier would still pass its own tests.
- Evidence: `api/routes/test-auth.ts`, `stack-e2e-auth.ts`; used by most route suites.
- Recommendation: keep the combined helper only where a test crosses tiers; use
  `playerHeaders()` / `serviceKeyHeaders()` elsewhere, or add a matrix assertion that each public
  route rejects the service key alone.

### Ownership depends on parameter names

- Severity: Medium
- Category: architecture / maintainability
- Problem: `registerPlayerOwnership` checks only `sessionId` and `conversationId` path params.
- Why it matters: a future public route with another resource param would skip ownership silently.
- Evidence: `api/hooks/player-credentials.ts`.
- Recommendation: a matrix assertion that every public route's path params are in the known set
  (`sessionId`, `conversationId`, `messageId`), so a new kind of id fails CI until ownership covers it.

### Duplicated admin sign-in UI and client glue

- Severity: Low
- Category: duplication
- Problem: `AuthGate`, `LoginPage`, `api/auth.ts`, and the signed-out listener exist in both
  `apps/admin` and `apps/console`, differing only in CSS classes and the request function.
- Why it matters: two copies drift.
- Evidence: `diff` of the two `api/auth.ts` files differs only in the request helper's name.
- Recommendation: acceptable for two small apps without a shared UI package; record as a
  conscious keep-separate rather than refactor now.

### Unreachable and redundant checks

- Severity: Low
- Category: dead code
- Problem: `GET /v1/admin/auth/me` re-checks `request.auth?.tier` (the hook guarantees it); the
  events stream re-loads the session to return 404 after the ownership hook already did.
- Evidence: `admin-auth.ts` lines 58–59 uncovered; `runtime-events.ts`.
- Recommendation: remove both.

### Web identity can diverge from the token after a forced new player

- Severity: Low
- Category: correctness
- Problem: when Core refuses to refresh a stored token, `getPlayer` silently creates a new player,
  but the stored persona identity keeps the old `userId` until the next reload sends the user to
  onboarding.
- Evidence: `apps/web/src/api/player-session.ts`, `App.tsx` `initializeState`.
- Recommendation: acceptable for an anonymous prototype; document it as a known limitation.

### Stale `userId` fields in tests

- Severity: Low
- Category: test hygiene
- Problem: several e2e/stack fixtures still post `userId` when starting sessions.
- Recommendation: remove them together with the strip-to-reject change.

## Architecture Review

Layering holds: routes delegate to application services (`AdminAuthService`, `PlayerTokenService`,
`PlayerAccessService`); hooks only translate outcomes into HTTP. Redis is reached only through
ports. The CORS policy is chosen by path rather than tier because preflights carry no tier; this is
explicit, commented, and backed by the matrix guarantee that `/v1/admin/*` is admin. No new
datastore, no JWT/cookie/rate-limit dependency.

## Test Review

- Strong: the real-server tier matrix (including 403 for player tokens on every admin route), the
  11 MB-body-not-read tests, cross-player 404 equivalence across 16 routes, cookie attribute and
  CSRF tests, the Redis adapters' single-transaction shape, and the bundle scanner.
- Weak: route tests using combined credentials (finding 2).
- Missing: an assertion that public routes only use known resource params (finding 3); a browser
  test of the console acting as a session owner.
- Implementation-coupled: `redis-rate-limiter.test.ts` asserts the exact command sequence —
  acceptable because the single round trip is the requirement.

## Documentation Gaps

None blocking: `API_CONTRACT.md` describes tiers, identity, ownership, and abuse controls, but its
"unknown fields are rejected" rule is not yet true (finding 1).

## Path to A

1. Reject unknown fields (`removeAdditional: false`) and remove stale `userId` payloads.
2. Add the public-route resource-param assertion to the matrix.
3. Add a matrix assertion that public routes reject the service key alone, so tier placement is
   proven per route even when route tests use combined credentials.
4. Remove the unreachable `/auth/me` branch and the redundant events-stream session lookup.

## Final Recommendation

Close with debt — the four steps above are small and should be applied before 12.2 builds on the
public contract.
