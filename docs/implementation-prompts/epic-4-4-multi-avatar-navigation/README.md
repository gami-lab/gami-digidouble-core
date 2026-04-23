# EPIC 4.4 — Multi-Avatar Navigation v1

## Objective

Add deterministic avatar routing and transition logic so users can move across avatars through progression, topic triggers, or explicit manual choice. The transition chain must be inspectable by operators.

**Generated:** April 23, 2026

---

## Execution Order

| #   | File                             | Deliverable                                                          |
| --- | -------------------------------- | -------------------------------------------------------------------- |
| 01  | `01-transition-domain-model.md`  | `AvatarTransitionRule` types + pure `transition-engine.ts` factory   |
| 02  | `02-gm-driven-switch.md`         | Activate `conversationMode: 'new'` path in `RunGameMasterUseCase`    |
| 03  | `03-manual-switch-endpoint.md`   | `SwitchAvatarUseCase` + `POST /v1/sessions/:sessionId/switch-avatar` |
| 04  | `04-session-avatar-endpoints.md` | Available-avatars + transition-history read endpoints                |
| 05  | `05-tests-and-doc-sync.md`       | Full hardening, integration tests, and doc sync                      |

---

## Dependencies Between Prompts

```
01  ──►  02  (GM integration depends on transition engine types)
01  ──►  03  (SwitchAvatarUseCase uses transition primitives)
02  ──►  04  (transition history relies on data written by 02 + 03)
03  ──►  04  (transition history relies on data written by 02 + 03)
01-04 ──► 05 (hardening pass works on top of all previous prompts)
```

Execute strictly in order. Do not start a prompt until all its dependencies pass lint, typecheck, and tests.

---

## Definition of Done (full EPIC)

- [ ] `AvatarTransitionRule` is part of `ScenarioConfig` — rule evaluation is a pure domain function
- [ ] GM `conversationMode: 'new'` path is active: closes current conversation, creates new one, updates `session.activeAvatarId`, passes handoff notes via `gmNotes`
- [ ] `POST /v1/sessions/:sessionId/switch-avatar` — manual switch that validates session + avatar, closes previous conversation, creates new conversation with handoff metadata
- [ ] `GET /v1/sessions/:sessionId/available-avatars` — returns scenario avatars from session context
- [ ] `GET /v1/sessions/:sessionId/avatar-transitions` — returns ordered transition history derived from conversations
- [ ] All three new API endpoints have `*.stack-e2e.test.ts` files covering auth, validation, and resource-not-found
- [ ] Unit tests cover: transition engine (all rule types + edge cases), GM-driven switch path, manual switch use case, history derivation
- [ ] `docs/API_CONTRACT.md` updated with all three new endpoints
- [ ] `docs/DATA_MODEL.md` updated with `avatarTransitionRules` in `ScenarioConfig`
- [ ] `docs/GAME_MASTER_CONTRACT.md` updated to document the activated `conversationMode: 'new'` path
- [ ] `docs/PROJECT_STATUS.md` updated — EPIC 4.4 marked complete
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass

---

## Key Design Decisions

| Decision                                                                             | Rationale                                                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Transition rules live in `ScenarioConfig.avatarTransitionRules`                      | Rules are data, not code — matches existing pattern for `policy` in GM config                                      |
| Transition engine is a pure domain function (no side effects)                        | Mirrors the trigger engine — deterministic, easily testable                                                        |
| GM `conversationMode: 'new'` activates real conversation creation                    | Deferred from EPIC 4.1 with a `// TODO` comment — this EPIC removes that deferral                                  |
| Manual switch always allowed (no rule gate)                                          | Explicit operator intent must not be blocked by config rules — but session and avatar validity are still validated |
| Transition history is derived from conversations                                     | No new table required — `conversations.reason`, `startedBy`, `handoffFromConversationId` already carry the data    |
| New conversation ID from GM-driven switch is NOT returned in `send-message` response | This is an async side effect; client polls `GET /sessions/:id/conversations` to discover the new conversation      |

---

## Pre-requisites

EPIC 4.1 (Async Game Master v1) must be complete and passing — specifically:

- `RunGameMasterUseCase` exists with `conversationMode: 'new'` parse + deferred comment
- `IConversationRepository` has `create()`, `listBySessionId()`, `update()` methods
- `sessions.conversations` table has `handoffFromConversationId`, `reason`, `startedBy` columns
