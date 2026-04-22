# Gami DigiDouble — Manual Test Console

A lightweight browser-based back-office UI for manual API testing.

It now follows the explicit model:

- **Session** = one scenario run
- **Conversation** = one avatar thread inside that session
- Switching avatar or returning to the same avatar starts a **new conversation**

---

## Prerequisites

- Node.js LTS + pnpm installed
- The Core API server running (see `/apps/core` or `docker-compose.yml`)

---

## Quick Start

### 1. Configure environment

```bash
cp apps/console/.env.example apps/console/.env
```

Edit `apps/console/.env`:

```env
VITE_API_URL=http://localhost:3000
VITE_API_KEY=change_me_in_production
```

### 2. Configure CORS on the Core

The console runs at `http://localhost:5173` by default.

```env
CORS_ORIGIN=*
# or
CORS_ORIGIN=http://localhost:5173
```

### 3. Start the dev server

```bash
# From workspace root:
pnpm --filter @gami/console dev

# Or from this directory:
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Main Flow

1. **Scenario** — create a scenario or select an existing one.
2. **Avatar** — create avatars for the selected scenario or select an existing one.
3. **Session** — start a session for a user.
4. **Start conversation with avatar** inside the session.
5. Send messages in the selected conversation.
6. Start another conversation with another avatar.
7. Start a **new** conversation with the same avatar later.
8. Use **Session conversations** + **Open previous conversation** to inspect separate threads.

---

## Package Scripts

| Script           | Description                          |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Start Vite dev server (port 5173)    |
| `pnpm build`     | Production bundle to `dist/`         |
| `pnpm typecheck` | TypeScript strict-mode type check    |
| `pnpm lint`      | ESLint on `src/`                     |
| `pnpm test`      | Vitest tests for state/model flow    |
| `pnpm preview`   | Serve the production `dist/` locally |

---

## Environment Variables

| Variable       | Required | Default                  | Description                                  |
| -------------- | -------- | ------------------------ | -------------------------------------------- |
| `VITE_API_URL` | No       | `http://localhost:3000`  | Base URL of the Core API                     |
| `VITE_API_KEY` | Yes      | _(empty — produces 401)_ | API key sent as `x-api-key` on every request |

---

## Architecture Notes

- **`src/api/`** — typed API clients for scenarios, avatars, sessions, conversations, and messages.
- **`src/pages/`** — scenario/avatar/session pages with explicit session-vs-conversation UX.
- **`src/pages/session-state.ts`** — deterministic state transitions for conversation list and message scoping.
- **`src/components/`** — shared UI (`DebugPanel`, `ErrorBoundary`, `LabeledInput`).
- **`src/env.ts`** — environment variable source (`VITE_API_URL`, `VITE_API_KEY`).
