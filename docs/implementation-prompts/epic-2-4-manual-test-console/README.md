# EPIC 2.4 — Manual Test Console v1

**Objective**
Build a lightweight browser-based back-office UI that lets developers and non-developers execute
the full platform flow — create scenario, create avatar, start session, send messages, view
history, reset session — without writing any code.

**Generated:** April 20, 2026

---

## Prompt files — ordered execution list

| #   | File                                                                     | What it delivers                                                                                                        |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | [01-console-package-bootstrap.md](01-console-package-bootstrap.md)       | New `apps/console/` workspace package: Vite + React + TypeScript, Turborepo wiring, API config, connectivity check page |
| 2   | [02-api-client-layer.md](02-api-client-layer.md)                         | Type-safe API client for all Core endpoints using `@gami/shared` types; error handling; environment config              |
| 3   | [03-scenario-avatar-management.md](03-scenario-avatar-management.md)     | Scenario creation form, avatar creation form, scenario/avatar selector for session setup                                |
| 4   | [04-session-chat-interface.md](04-session-chat-interface.md)             | Start session, chat UI, send message, history display, reset session                                                    |
| 5   | [05-debug-metadata-and-hardening.md](05-debug-metadata-and-hardening.md) | Per-message debug panel (latency, tokens, model), error display, polish, doc sync                                       |

---

## Dependencies between prompts

```
01 (package + scaffold)
 └─► 02 (API client layer)
      ├─► 03 (scenario/avatar forms use client)
      └─► 04 (session/chat uses client)
           └─► 05 (debug panel sits inside chat view)
```

Prompts 03 and 04 can be implemented in parallel once 02 is done. Prompt 05 must follow 04.

---

## What is NOT in scope for this EPIC

- Authentication for the console itself — it uses the existing Core API key configured in `.env`
- Listing / searching / paginating scenarios or avatars
- User account management
- Production deployment of the console
- Real-time updates / WebSocket streaming
- Styling beyond functional readability

---

## Definition of Done

- [ ] `apps/console/` package exists in the pnpm workspace and builds cleanly
- [ ] Console dev server starts with `pnpm dev` from workspace root (or `pnpm --filter @gami/console dev`)
- [ ] Non-developer can, using only the browser UI, execute this exact flow without touching code:
  1. Create a scenario
  2. Create an avatar for that scenario
  3. Start a session
  4. Send multiple messages and receive avatar replies
  5. View the full message history
  6. Reset the session
- [ ] Each avatar message displays at least: model name, latency (ms), input/output token counts
- [ ] Error responses from the Core API are surfaced in the UI (not silently swallowed)
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass across the workspace
- [ ] `docs/PROJECT_STATUS.md` updated to mark EPIC 2.4 complete with delivered scope
