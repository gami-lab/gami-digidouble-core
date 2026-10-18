# Title

Add Rate Limits, Body Limits, And Per-Tier CORS

# Context

Once the player tier is open to the internet, every message and voice turn costs LLM, STT, and TTS
money. Token issue and admin login are brute-force and abuse targets. CORS is one global origin
list today (`config.corsOrigin` in `server.ts`). This slice bounds abuse and tightens browser
access per tier.

# Scope

Implement now:

- rate limits backed by Redis (works across Core instances), keyed by player `userId` for public
  routes and by client IP for `open` routes:
  - `POST /v1/auth/player`, `POST /v1/admin/auth/login`
  - text and SSE message routes, voice and voice-stream routes, message-audio route
  - session start
- `429 RATE_LIMITED` in the `ApiResponse` envelope with `Retry-After`
- explicit body limits on every JSON route (small default) and on voice routes (existing bounds);
  oversized → `400 VALIDATION_ERROR` per the existing voice convention, or `413` if the contract is
  changed deliberately and documented
- CORS per tier: public routes allow the player origin(s) without credentials; admin routes allow
  only the admin origin(s) with credentials; `exposedHeaders`/`allowedHeaders` limited to what each
  tier uses (drop `x-api-key` from public)
- limits and origins configurable per environment with safe defaults

Out of scope:

- WAF, bot detection, CAPTCHAs, per-scenario quotas, billing

# Relevant Docs

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md` (Redis keys)

# Implementation Guidance

- Prefer `@fastify/rate-limit` with the existing Redis client if it fits the tier hook cleanly;
  otherwise a small fixed-window counter behind an application port. Either way record the choice
  in `docs/TECH_STACK.md`.
- Rate-limit configuration lives with the tier/route declaration from `01`, not in a separate map.
- Proxy awareness: configure Fastify `trustProxy` for the Coolify/Traefik hop so IP keys are the
  client, not the proxy. Verify against the actual deployment.
- `@fastify/cors` supports a per-request origin delegate; use the route tier to choose the policy.
- Tests:
  - route/stack-e2e: exceeding the limit returns 429 with `Retry-After`; another user is unaffected
  - oversized JSON body is rejected; voice limits unchanged
  - CORS preflight from the player origin to an admin route is refused; admin origin with
    credentials succeeds

# Constraints

- Limits must not delay normal turns (one Redis round trip at most).
- Do not log full IPs beyond what existing logs already do; no tokens in limiter keys.
- Fail-closed vs fail-open on Redis outage: choose explicitly, document, and test.

# Deliverables

- rate limiting on the listed routes, body limits on all JSON routes, per-tier CORS
- configuration with defaults and env documentation
- tests for 429, body limits, CORS per tier, Redis-outage behavior

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (error envelope, config, CORS headers).
2. Search for duplicated limit constants (voice body limits, upload limits).
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` (rate-limit and body-limit rules, CORS per tier)
- `docs/TECH_STACK.md` (dependency, env vars)
- `docs/DATA_MODEL.md` (Redis limiter keys)

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Message, voice, audio, session-start, token-issue, and login routes return 429 past their limit.
- [ ] Every JSON route has an explicit body limit.
- [ ] Player origin cannot make credentialed calls to admin routes; admin origin can.
- [ ] Redis-outage behavior is explicit and tested.
- [ ] Documentation reviewed and updated.
