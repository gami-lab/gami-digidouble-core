# 06 — Documentation Sync + EPIC 2.6 Hardening

## Context

All implementation work for EPIC 2.6 is complete across prompts 01–05. This final prompt ensures:

1. All changed contracts, data models, and architecture notes are reflected in docs
2. No silent drift exists between code and documentation
3. The EPIC is officially closed in `PROJECT_STATUS.md`

## Scope

### Mandatory doc updates

- `docs/API_CONTRACT.md` — add contract blocks for both admin endpoints (if not already done in prompts 02/03)
- `docs/GAME_MASTER_CONTRACT.md` §14 — mark `GET /v1/admin/sessions/{sessionId}/events` as implemented; remove "Phase B" deferral comment
- `docs/PROJECT_STATUS.md` — add EPIC 2.6 completion entry

### Verify (no changes expected unless missed)

- `docs/ARCHITECTURE.md` — verify `admin-sessions.ts` route file is consistent with module map
- `docs/DATA_MODEL.md` — no schema changes in this EPIC; confirm `event_log` table description is accurate
- `docs/TEST_STRATEGY.md` — confirm stack-e2e rule is satisfied

### Out of scope

- New endpoints, new code, new tests — this prompt is docs-only
- Retroactive changes to earlier epics

## Relevant Docs

All docs listed in previous prompts, plus:

- `docs/EPICS.md` — EPIC 2.6 block, to verify DoD alignment

## Implementation Guidance

### API_CONTRACT.md additions

Add two new sections after the EPIC 2.5 admin session blocks:

#### GET /v1/admin/sessions/{sessionId}/inspect

```md
## Admin: Inspect Session

### Endpoint

    GET /v1/admin/sessions/{sessionId}/inspect

### Response

    type SessionInspectResponse = {
      inspect: {
        session: SessionSummary
        gmState: {
          currentAvatarId?: string
          progression: string
          topicsCovered: string[]
          interactionCount: number
        } | null
        transitionHistory: Array<{
          fromAvatarId: string | null
          toAvatarId: string
          reason: string | null
          startedBy: 'user' | 'gm' | 'system' | null
          transitionedAt: string
        }>
        unlockedAvatarIds: string[]
        gmNotes: string | null
      }
    }

### Error Mapping

- 401 → UNAUTHORIZED
- 404 → NOT_FOUND (session not found)
- 500 → INTERNAL_ERROR

### Safety

No raw message content, no prompt text, no LLM model names are exposed.
`gmNotes` is director guidance only.
```

#### GET /v1/admin/sessions/{sessionId}/events

```md
## Admin: List Session Events

### Endpoint

    GET /v1/admin/sessions/{sessionId}/events

### Query Parameters

| Parameter | Type    | Default | Max | Description                    |
| --------- | ------- | ------- | --- | ------------------------------ |
| limit     | integer | 50      | 200 | Max number of events to return |

### Response

    type ListSessionEventsResponse = {
      events: Array<{
        type: 'gm_triggered' | 'gm_skipped'
        correlationId: string
        createdAt: string
        payload: {
          triggerReason: string
          turnIndex: number
          interactionCount: number
          stateBefore: { currentAvatarId?: string; progression: string; topicsCovered: string[] }
          decision?: { avatarId: string; conversationMode: string; notesInjected: boolean; directiveCount: number }
          stateAfter?: { currentAvatarId?: string; progression: string; topicsCovered: string[] }
          latencyMs: number
          inputTokens?: number
          outputTokens?: number
        }
      }>
    }

Events are ordered newest-first. Only `gm_triggered` and `gm_skipped` event types are returned.

### Error Mapping

- 401 → UNAUTHORIZED
- 400 → VALIDATION_ERROR (invalid limit param)
- 404 → NOT_FOUND (session not found)
- 500 → INTERNAL_ERROR
```

### GAME_MASTER_CONTRACT.md §14

Update the final note to:

> Admin inspection endpoint `GET /v1/admin/sessions/{sessionId}/events` is **implemented** (EPIC 2.6).
> See `docs/API_CONTRACT.md` for full contract.

Remove the inline `// Phase B:` comment from `IEventLogRepository.ts` — it should already be gone
after prompt 01, but verify the source file.

### PROJECT_STATUS.md

Add an entry at the top of the status list:

```md
### EPIC 2.6 — GM Debug Panel v1 + Observability APIs: **complete** (April 2026)

- `IEventLogRepository.findBySessionId` implemented (in-memory + Postgres)
- `GET /v1/admin/sessions/{sessionId}/inspect` — session + GM state + transition history
- `GET /v1/admin/sessions/{sessionId}/events` — GM event log, newest-first, limit param
- `admin-sessions.stack-e2e.test.ts` — auth, validation, not-found, happy-path coverage
- GM Debug Panel added to Scenario Test Bench console; auto-refreshes after each turn
- Panel displays: active avatar, unlocked avatars, GM notes, transition history, recent events
- No sensitive prompt/credential exposure in any admin endpoint
- `pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage` all pass
```

## Constraints

- Do not edit code in this prompt — documentation updates only
- If a doc change would require a code change, flag it as a separate follow-up issue

## Deliverables

- Updated `docs/API_CONTRACT.md` with both admin endpoint contracts
- Updated `docs/GAME_MASTER_CONTRACT.md` §14 status note
- Updated `docs/PROJECT_STATUS.md` with EPIC 2.6 completion entry
- Verified `IEventLogRepository.ts` has no remaining Phase B deferral comment

## Acceptance Criteria

- [ ] `docs/API_CONTRACT.md` contains `GET /v1/admin/sessions/{sessionId}/inspect` contract
- [ ] `docs/API_CONTRACT.md` contains `GET /v1/admin/sessions/{sessionId}/events` contract
- [ ] `docs/GAME_MASTER_CONTRACT.md` §14 marks endpoint as implemented
- [ ] `docs/PROJECT_STATUS.md` shows EPIC 2.6 as complete with all key deliverables listed
- [ ] `IEventLogRepository.ts` has no `// Phase B` comment for `findBySessionId`
- [ ] No docs reference unimplemented features as if they are done
