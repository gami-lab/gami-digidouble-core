# Title

Add Admin Sign-In With A Session Cookie And A Server-Side Service Key

# Context

Admin routes are now isolated under `/v1/admin` (prompt `01`) but still accept the shared key that
ships in browser bundles. Admins need a real sign-in, and server-side tools
(`tools/conversation-evaluation`, local `apps/console` runs) need a credential that never enters a
Vite build. This slice adds both and stops admin routes from accepting the old shared key.

# Scope

Implement now:

- `POST /v1/admin/auth/login` (tier `open`, rate-limited): verifies an operator password against a
  hash in Core config, creates a session in Redis with a TTL, sets an `HttpOnly`, `Secure`,
  `SameSite` cookie
- `POST /v1/admin/auth/logout` and `GET /v1/admin/auth/me` (tier `admin`)
- admin-tier verifier accepts either a valid admin session cookie or the `ADMIN_SERVICE_KEY` header;
  nothing else
- CSRF protection for cookie-authenticated state-changing requests (SameSite plus an origin check
  or a required custom header; pick one and test it)
- `apps/admin`: login screen, signed-in shell, logout, redirect to login on `401`; requests use
  `credentials: 'include'` and no API key
- `apps/console` and `tools/conversation-evaluation`: send the service key from local/server env
  only (console may instead use the login flow; document which)
- config validation: Core refuses to start in production without a password hash, a cookie secret,
  and a service key of sufficient length

Out of scope:

- OIDC, multiple admin accounts, roles, password reset UI
- player token (prompt `03`)
- removing build args from compose (prompt `05`)

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md` (Redis keys)
- `docs/PRINCIPLES.md`

# Implementation Guidance

- Ports first: an application port for the admin session store (create/read/delete with TTL) with a
  Redis adapter and an in-memory adapter for tests, matching existing repository/adapter patterns.
  The password check sits behind a small verifier so OIDC can replace it later without route changes.
- Password hashing: `node:crypto` `scrypt` with a stored salt+hash string; constant-time compare.
  No new dependency unless cookie handling genuinely needs `@fastify/cookie` — if added, record it
  in `docs/TECH_STACK.md`.
- Check the deployed origins (admin SPA vs Core URL in `docker-compose.coolify.yml`/Coolify) before
  choosing `SameSite`. Prefer same-site subdomains with `SameSite=Lax`/`Strict`; only use `None`
  if origins are cross-site, and then the CSRF check is mandatory.
- Login failures return `401 UNAUTHORIZED` with no hint whether the password or account was wrong;
  log a bounded `admin_auth.*` event without the submitted value.
- Shared DTOs for login/me responses go in `packages/shared/src/` (new `auth-contract-types.ts` or
  an existing owner); admin client imports them.
- New endpoints need `admin-auth.stack-e2e.test.ts`: no credential → 401, wrong password → 401,
  invalid body → 400, valid login → cookie works on an admin route, logout invalidates it.

# Constraints

- No secret in any frontend bundle or `VITE_*` variable.
- Cookie and session lifetime bounded; session ids are random, never derived from the password.
- Do not log passwords, cookies, session ids, or service keys.
- KISS: one operator account for Phase A.

# Deliverables

- login/logout/me routes, session store port + Redis and in-memory adapters, admin verifier
- admin SPA login flow; console and evaluation tool on server-side credentials
- config validation and `.env.example` entries (names only, no values)
- unit, route, and stack-e2e tests including CSRF and expiry

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (admin client protocol, config, Redis keyspace).
2. Search for duplicated request helpers in `apps/admin`, `apps/console`, and tools.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` (admin authentication, new routes)
- `docs/ARCHITECTURE.md` (admin auth flow, session store port)
- `docs/DATA_MODEL.md` (Redis admin-session keys and TTL)
- `docs/TECH_STACK.md` (any new dependency, new env vars)

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Every admin route rejects the old shared key and accepts only a valid session cookie or service key.
- [ ] Admin SPA requires login; logout and expiry return the user to the login screen.
- [ ] CSRF check rejects a cross-origin state-changing request.
- [ ] Console and evaluation tool work without any `VITE_*` secret.
- [ ] Stack-e2e covers auth, validation, success, and logout.
- [ ] Documentation reviewed and updated.
