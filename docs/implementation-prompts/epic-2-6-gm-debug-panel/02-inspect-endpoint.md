# 02 — Inspect Endpoint: `GET /v1/admin/sessions/{sessionId}/inspect`

## Context

Operators and testers have no visibility into what happened inside a session after a turn fires.
They must currently query the database directly to understand the active avatar, GM notes, unlocked
avatars, and transition history.

This endpoint provides a single, admin-safe snapshot of a session's current orchestration state
without exposing sensitive prompt content or user message text.

## Scope

### In scope

- `InspectSessionUseCase` in `apps/core/src/application/use-cases/inspect-session/`
- Route handler wired under `GET /v1/admin/sessions/:sessionId/inspect`
- Response shape: session summary + GM state snapshot + transition history (newest-first)
- Auth enforcement via existing `x-api-key` guard
- `404` for unknown session

### Out of scope

- Raw message content — never exposed here
- Prompt text — never exposed here
- `gm_notes` raw content is safe to surface (it is director guidance, not a user message)
- Pagination — response is flat for Phase A
- `GET /v1/admin/sessions/{sessionId}/gm-state` standalone endpoint (optional per EPIC, defer if inspect covers the need)

## Relevant Docs

- `docs/API_CONTRACT.md` — response envelope pattern and error codes
- `docs/GAME_MASTER_CONTRACT.md` §6 (GameMasterState) and §15 (Avatar Switch Flow)
- `docs/ARCHITECTURE.md` — application / domain / infrastructure layering
- `apps/core/src/application/ports/IGmStateRepository.ts`
- `apps/core/src/domain/game-master/game-master.types.ts` — `GameMasterState`
- `apps/core/src/infrastructure/db/repositories/postgres-gm-state.repository.ts`

## Implementation Guidance

### Response type

```ts
type SessionInspectResponse = {
  inspect: {
    session: SessionSummary // from ISessionRepository.findById
    gmState: {
      currentAvatarId?: string
      progression: string
      topicsCovered: string[]
      interactionCount: number
    } | null // null if GM has not run yet for this session
    transitionHistory: Array<{
      fromAvatarId: string | null
      toAvatarId: string
      reason: string | null
      startedBy: 'user' | 'gm' | 'system' | null
      transitionedAt: string
    }>
    unlockedAvatarIds: string[] // from session.unlockedAvatarIds
    gmNotes: string | null // from session.gmNotes
  }
}
```

### Use case

`InspectSessionUseCase` constructor takes:

- `ISessionRepository`
- `IGmStateRepository`
- `IConversationRepository` (for transition history via `findBySessionId`)

Logic:

1. `sessionRepository.findById(sessionId)` — throw `DomainError('NOT_FOUND')` if null
2. `gmStateRepository.findBySessionId(sessionId)` — may be null for fresh sessions
3. `conversationRepository.findBySessionId(sessionId)` — derive transition history from conversation
   records (ordered by `startedAt`, map each to a transition entry using `avatarId` changes)
4. Return flat `inspect` response

Transition history derivation: iterate conversations ordered by `startedAt`, pair each conversation
with the previous one to produce `fromAvatarId → toAvatarId` entries. `startedBy` comes from the
conversation record if available, otherwise `null`.

### Route

Mount under `/v1/admin` prefix. Add the admin routes group to `apps/core/src/api/routes/` as a new
file `admin-sessions.ts` (separate from the existing `sessions.ts` to keep admin and user-facing
concerns segregated).

Register it in `apps/core/src/api/index.ts` alongside existing route registrations.

### Auth

Reuse the existing `x-api-key` guard — no special admin-only auth for Phase A.

### Error mapping

| Condition               | HTTP | Code             |
| ----------------------- | ---- | ---------------- |
| Missing / wrong API key | 401  | `UNAUTHORIZED`   |
| Session not found       | 404  | `NOT_FOUND`      |
| Internal failure        | 500  | `INTERNAL_ERROR` |

## Constraints

- No raw message content, no prompt text, no LLM model names in the response
- `gmNotes` field is safe to surface — it is injected guidance, not user data
- Use `DomainError` for domain-level not-found; map to HTTP in the route handler
- Respect 4-layer architecture: route handler → use case → domain ports — no direct repo access from handler
- Max 100 lines per function (ESLint rule); break helpers out if needed

## Deliverables

- `apps/core/src/application/use-cases/inspect-session/inspect-session.use-case.ts`
- `apps/core/src/application/use-cases/inspect-session/inspect-session.use-case.test.ts`
- `apps/core/src/api/routes/admin-sessions.ts` (new file — inspect route only for now)
- Route registration in server setup
- Console API client stub in `apps/console/src/api/` (function `inspectSession(sessionId)` → fetch)

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/API_CONTRACT.md` — add `GET /v1/admin/sessions/{sessionId}/inspect` contract block
- `docs/PROJECT_STATUS.md` — note endpoint added under EPIC 2.6

## Acceptance Criteria

- [ ] `InspectSessionUseCase` implemented with unit tests (mocked repos)
- [ ] Route mounted and returns correct shape for an existing session
- [ ] `401` returned when API key is missing or invalid
- [ ] `404` returned for unknown `sessionId`
- [ ] Response contains no message content, no prompt text
- [ ] `transitionHistory` derives correctly from conversation sequence
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass
