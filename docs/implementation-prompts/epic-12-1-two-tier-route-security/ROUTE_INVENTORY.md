# Route Inventory — EPIC 12.1 Baseline

Working notes for prompt `00`. Captured from the real server (`createServer` + Fastify `onRoute`),
before any route moved. `HEAD` twins of `GET` routes and the CORS `OPTIONS *` preflight route are
omitted. Callers: `web` (player app), `admin` (authoring app), `console` (operator debug app),
`eval` (`tools/conversation-evaluation`), `seed` (`apps/core/src/seed/murder-party`).

| Method | Path (baseline)                                               | Plugin file                     | Callers                       | Intended tier | Target path / note                                      |
| ------ | ------------------------------------------------------------- | ------------------------------- | ----------------------------- | ------------- | ------------------------------------------------------- |
| GET    | `/health`                                                     | `health.ts`                     | infra probes                  | open          | unchanged                                               |
| POST   | `/v1/exchange`                                                | `exchange.ts`                   | eval (judge)                  | admin         | `/v1/admin/exchange`                                    |
| POST   | `/v1/sessions`                                                | `sessions.ts`                   | web, console, eval            | public        | `userId` from token (prompt 03)                         |
| GET    | `/v1/sessions`                                                | `sessions.ts`                   | web (own), console (scenario) | public+admin  | public: caller's sessions; admin: `/v1/admin/sessions`  |
| GET    | `/v1/sessions/:sessionId`                                     | `sessions.ts`                   | —                             | public        | ownership check (03)                                    |
| DELETE | `/v1/sessions/:sessionId`                                     | `sessions.delete-route.ts`      | —                             | admin         | `/v1/admin/sessions/:sessionId`                         |
| POST   | `/v1/sessions/:sessionId/reset`                               | `sessions.ts`                   | console                       | public        | ownership check                                         |
| POST   | `/v1/sessions/:sessionId/conversations`                       | `sessions.ts`                   | web, console, eval            | public        | ownership check                                         |
| GET    | `/v1/sessions/:sessionId/conversations`                       | `sessions.ts`                   | console                       | public        | ownership check                                         |
| POST   | `/v1/sessions/:sessionId/conversations/:conversationId/end`   | `sessions.ts`                   | web                           | public        | ownership check                                         |
| POST   | `/v1/sessions/:sessionId/switch-avatar`                       | `sessions.ts`                   | —                             | public        | ownership check                                         |
| GET    | `/v1/sessions/:sessionId/available-avatars`                   | `sessions.ts`                   | web, console                  | public        | ownership check; trimmed projection                     |
| GET    | `/v1/sessions/:sessionId/avatar-transitions`                  | `sessions.ts`                   | —                             | public        | ownership check                                         |
| GET    | `/v1/sessions/:sessionId/runtime-state`                       | `runtime-events.ts`             | web                           | public        | ownership check                                         |
| GET    | `/v1/sessions/:sessionId/events/stream`                       | `runtime-events.ts`             | web, console                  | public        | ownership check before stream opens                     |
| POST   | `/v1/conversations/:conversationId/messages`                  | `conversations.ts`              | web, console, eval            | public        | ownership check                                         |
| POST   | `/v1/conversations/:conversationId/messages/stream`           | `conversations.ts`              | web                           | public        | ownership check                                         |
| GET    | `/v1/conversations/:conversationId/history`                   | `conversations.ts`              | web, console                  | public        | ownership check                                         |
| POST   | `/v1/conversations/:conversationId/voice-messages`            | `voice-messages.ts`             | —                             | public        | ownership check                                         |
| POST   | `/v1/conversations/:conversationId/voice-messages/stream`     | `voice-messages.ts`             | web                           | public        | ownership check                                         |
| POST   | `/v1/conversations/:conversationId/messages/:messageId/audio` | `conversation-message-audio.ts` | web                           | public        | ownership check before synthesis                        |
| PUT    | `/v1/users/:userId/persona`                                   | `users.ts`                      | web                           | public        | `/v1/me/persona` (03)                                   |
| GET    | `/v1/users/:userId/persona`                                   | `users.ts`                      | —                             | public        | `/v1/me/persona` (03)                                   |
| GET    | `/v1/scenarios`                                               | `scenarios.ts`                  | web, admin, console, seed     | public+admin  | public: active catalogue; admin: `/v1/admin/scenarios`  |
| GET    | `/v1/scenarios/:scenarioId`                                   | `scenarios.ts`                  | admin, console, seed          | admin         | `/v1/admin/scenarios/:scenarioId`                       |
| POST   | `/v1/scenarios`                                               | `scenarios.ts`                  | admin, seed                   | admin         | `/v1/admin/scenarios`                                   |
| PATCH  | `/v1/scenarios/:scenarioId`                                   | `scenarios.ts`                  | admin, seed                   | admin         | `/v1/admin/scenarios/:scenarioId`                       |
| DELETE | `/v1/scenarios/:scenarioId`                                   | `scenarios.ts`                  | admin                         | admin         | `/v1/admin/scenarios/:scenarioId`                       |
| POST   | `/v1/scenarios/:scenarioId/prepare-avatar-traits`             | `scenarios.ts`                  | admin, console, seed          | admin         | `/v1/admin/scenarios/:scenarioId/prepare-avatar-traits` |
| POST   | `/v1/scenarios/:scenarioId/avatars`                           | `scenarios.ts`                  | admin, seed                   | admin         | `/v1/admin/scenarios/:scenarioId/avatars`               |
| GET    | `/v1/scenarios/:scenarioId/avatars`                           | `scenarios.ts`                  | admin, console, eval, seed    | admin         | `/v1/admin/scenarios/:scenarioId/avatars`               |
| PATCH  | `/v1/avatars/:avatarId`                                       | `avatars.ts`                    | admin, eval, seed             | admin         | `/v1/admin/avatars/:avatarId`                           |
| DELETE | `/v1/avatars/:avatarId`                                       | `avatars.ts`                    | admin                         | admin         | `/v1/admin/avatars/:avatarId`                           |
| POST   | `/v1/knowledge-sources`                                       | `knowledge.ts`                  | admin, seed                   | admin         | `/v1/admin/knowledge-sources`                           |
| POST   | `/v1/knowledge-sources/upload`                                | `knowledge.ts`                  | admin                         | admin         | `/v1/admin/knowledge-sources/upload`                    |
| GET    | `/v1/scenarios/:scenarioId/knowledge-sources`                 | `knowledge.ts`                  | admin, console, seed          | admin         | `/v1/admin/scenarios/:scenarioId/knowledge-sources`     |
| PATCH  | `/v1/knowledge-sources/:sourceId`                             | `knowledge.ts`                  | admin, seed                   | admin         | `/v1/admin/knowledge-sources/:sourceId`                 |
| DELETE | `/v1/knowledge-sources/:sourceId`                             | `knowledge.ts`                  | admin, seed                   | admin         | `/v1/admin/knowledge-sources/:sourceId`                 |
| POST   | `/v1/knowledge-sources/:sourceId/ingest`                      | `knowledge.ts`                  | admin, seed                   | admin         | `/v1/admin/knowledge-sources/:sourceId/ingest`          |
| GET    | `/v1/knowledge-sources/:sourceId/ingestion-jobs`              | `knowledge.ts`                  | admin, console                | admin         | `/v1/admin/knowledge-sources/:sourceId/ingestion-jobs`  |
| GET    | `/v1/ingestion-jobs/:ingestionJobId`                          | `knowledge.ts`                  | admin, seed                   | admin         | `/v1/admin/ingestion-jobs/:ingestionJobId`              |
| GET    | `/v1/knowledge-sources/:sourceId/chunks`                      | `knowledge.ts`                  | admin, console                | admin         | `/v1/admin/knowledge-sources/:sourceId/chunks`          |
| POST   | `/v1/admin/knowledge/retrieval`                               | `knowledge.ts`                  | admin, console                | admin         | unchanged (registered only with typed retrieval)        |
| GET    | `/v1/admin/health`                                            | `admin-health.ts`               | admin                         | admin         | unchanged                                               |
| GET    | `/v1/admin/model-config`                                      | `admin-model-config.ts`         | admin                         | admin         | unchanged                                               |
| PUT    | `/v1/admin/model-config`                                      | `admin-model-config.ts`         | admin                         | admin         | unchanged                                               |
| GET    | `/v1/admin/voices`                                            | `admin-voices.ts`               | admin                         | admin         | unchanged                                               |
| GET    | `/v1/admin/sessions/:sessionId/inspect`                       | `admin-sessions.ts`             | console                       | admin         | unchanged                                               |
| GET    | `/v1/admin/sessions/:sessionId/events`                        | `admin-sessions.ts`             | console, eval                 | admin         | unchanged                                               |
| GET    | `/v1/admin/sessions/:sessionId/memory-layers`                 | `admin-memory.ts`               | console                       | admin         | unchanged                                               |
| GET    | `/v1/admin/sessions/:sessionId/context`                       | `admin-session-context.ts`      | console                       | admin         | unchanged                                               |
| POST   | `/v1/admin/sessions/:sessionId/gm/replay`                     | `admin-runtime-actions.ts`      | console                       | admin         | unchanged                                               |
| POST   | `/v1/admin/sessions/:sessionId/memory/refresh`                | `admin-runtime-actions.ts`      | console                       | admin         | unchanged                                               |
| POST   | `/v1/admin/sessions/:sessionId/memory/clear`                  | `admin-runtime-actions.ts`      | console                       | admin         | unchanged                                               |
| POST   | `/v1/admin/knowledge/reindex`                                 | `admin-knowledge-reindex.ts`    | seed                          | admin         | unchanged                                               |
| GET    | `/v1/admin/knowledge/reindex/:reindexOperationId`             | `admin-knowledge-reindex.ts`    | seed                          | admin         | unchanged                                               |
| POST   | `/v1/admin/knowledge/reindex/:reindexOperationId/retry`       | `admin-knowledge-reindex.ts`    | —                             | admin         | unchanged                                               |

## Notes

- Before prompt `00` the shared key was attached five different ways (`preHandler` per plugin,
  `preValidation` in `knowledge.ts`, `onRequest` per route in the voice and audio plugins, a
  per-route `preHandler` in `exchange.ts`). Prompt `00` replaced them with one `onRequest` hook in
  `server.ts`; `onRequest` runs before content-type parsing, so unauthenticated voice, upload, and
  audio bodies are never read.
- The console and the evaluation tool drive player routes (start session, send message) as well as
  admin routes; after prompt `03` they obtain a player token for the player part.
- New routes added by this EPIC (`open`): `POST /v1/auth/player`, `POST /v1/admin/auth/login`.
