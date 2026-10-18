# Title

Issue Short-Lived Player Tokens And Enforce Session Ownership

# Context

Public routes still accept the shared key, and the browser chooses its own `userId`
(`apps/web/src/identity/local-identity.ts`), so anyone who learns a session id can read it. Core
must issue the player identity and check it on every player route. This slice is the core of the
"another user's session returns 404" guarantee.

# Scope

Implement now:

- `POST /v1/auth/player` (tier `open`, rate-limited): creates a Core-generated `userId` and returns
  `{ userId, token, expiresAt }`; with a still-valid token it refreshes instead of creating a user
- token: HMAC-SHA256 signed, carries `userId`, issued-at, expiry; short TTL (minutes to a few hours,
  configurable); verified with constant-time compare; secret from Core config only
- public-tier verifier accepts only `Authorization: Bearer <player token>`
- remove client-chosen identity from public requests:
  - `POST /v1/sessions` takes no `userId`; Core uses the token's user
  - `GET /v1/sessions` lists only the caller's sessions
  - persona moves to a caller-scoped path (e.g. `PUT|GET /v1/me/persona`)
- ownership checks on every public route that takes a `sessionId`, `conversationId`, or `messageId`:
  sessions, conversations, history, messages (JSON, SSE, voice), message audio, end, reset,
  switch-avatar, available-avatars, avatar-transitions, runtime-state, events stream
- foreign or unknown resource → `404 NOT_FOUND` with the same body (no existence leak)
- player token on any admin route → `403 FORBIDDEN`
- `apps/web`: obtain/refresh the token, store it (not the shared key), drop the locally generated
  `userId`; `tools/conversation-evaluation` obtains player tokens for its scripted players

Out of scope:

- accounts, login for players, cross-device identity
- rate limits beyond the token-issue route (prompt `04`)

# Relevant Docs

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/GAME_MASTER_CONTRACT.md` (session events must keep their identity)
- `docs/TEST_STRATEGY.md`

# Implementation Guidance

- Ownership is an application concern: put one `assertSessionOwnedBy(userId)` style check in the
  use cases (or a small application service they share) that resolves session → user and
  conversation → session → user. The API passes the token's `userId` in; it does not query
  repositories itself.
- Return a typed domain/application failure for "not owned" and map it to `404` in
  `route-error.ts`; do not add a route-local error code.
- The SSE events stream and binary audio route must check ownership before opening the stream or
  starting synthesis.
- Admin-tier routes act on any session by design; keep that path separate from player ownership.
- Shared token/identity DTOs: `packages/shared/src/` (extend the auth contract module from `02`).
  `LocalWebIdentity` in shared must lose `userId` generation semantics or be replaced.
- Required tests:
  - unit: token sign/verify, expiry, tampering, wrong secret
  - application: ownership resolution for session, conversation, message
  - `player-auth.stack-e2e.test.ts`: no token → 401, tampered/expired → 401, invalid body → 400,
    success returns a usable token
  - cross-user stack-e2e: user A's session/history/runtime-state/events/audio requested by user B → 404
  - tier matrix extension: a player token gets 403 on every admin route

# Constraints

- No JWT/OIDC dependency unless measured need; `node:crypto` is enough.
- Tokens never logged; diagnostics record only `userId`.
- GM and memory work remain asynchronous; ownership checks add no LLM or provider calls.

# Deliverables

- player token route, signer/verifier, config, public-tier verifier
- token-derived identity on all public routes; removed `userId` inputs
- ownership checks in application layer with typed failures
- web and evaluation-tool clients migrated
- unit, application, route, and stack-e2e tests listed above

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (User, Session, Conversation, Message, `LocalWebIdentity`,
   persona DTOs, start-session schema).
2. Search for duplicated type definitions of session/persona requests in web, console, tools.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` (player auth, ownership invariant, changed request shapes)
- `docs/ARCHITECTURE.md` (identity flow)
- `docs/DATA_MODEL.md` if user creation or persona storage changes
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Public routes accept only a valid player token; the shared key no longer works there.
- [ ] No public request accepts a client-chosen `userId`.
- [ ] Cross-user session, conversation, history, runtime, events, and audio reads return 404.
- [ ] Player token on every admin route returns 403.
- [ ] Web player and evaluation tool work end to end with player tokens.
- [ ] Documentation reviewed and updated.
