# Gami DigiDouble — Manual Test Console

A lightweight browser-based back-office UI for exercising the full platform flow without writing code: create a scenario, configure an avatar, start a session, chat, inspect debug metadata, and reset.

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
VITE_API_URL=http://localhost:3000   # URL where the Core API is reachable
VITE_API_KEY=change_me_in_production # must match API_KEY_SECRET in apps/core/.env
```

### 2. Configure CORS on the Core

The console runs at `http://localhost:5173` by default. The Core must allow this origin.
In your Core `.env` (root `.env.example` or `CORS_ORIGIN` env var):

```env
CORS_ORIGIN=*                        # dev / internal tools
# or restrict to the exact origin:
CORS_ORIGIN=http://localhost:5173
```

### 3. Start the dev server

```bash
# From workspace root:
pnpm --filter @gami/console dev

# Or from this directory:
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Full Flow

1. **Scenario** — Enter a name, choose a status (`draft` / `active`), click _Create Scenario_.
2. **Avatar** — Enter a name, persona prompt, optional tone and description, click _Create Avatar_.
3. **Session** — Enter a user ID, click _Start Session_, then type messages and send them.
4. Each avatar reply shows a collapsible **Debug** panel with model, latency (ms), and token counts.
5. Use **Reset** to wipe the session's message history and start a fresh conversation.

---

## Package Scripts

| Script           | Description                          |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | Start Vite dev server (port 5173)    |
| `pnpm build`     | Production bundle to `dist/`         |
| `pnpm typecheck` | TypeScript strict-mode type check    |
| `pnpm lint`      | ESLint on `src/`                     |
| `pnpm preview`   | Serve the production `dist/` locally |

---

## Environment Variables

| Variable       | Required | Default                  | Description                                  |
| -------------- | -------- | ------------------------ | -------------------------------------------- |
| `VITE_API_URL` | No       | `http://localhost:3000`  | Base URL of the Core API                     |
| `VITE_API_KEY` | Yes      | _(empty — produces 401)_ | API key sent as `x-api-key` on every request |

---

## Architecture Notes

- **`src/api/`** — Typed API client modules; all HTTP calls go through `coreRequest<T>` in `client.ts`.
- **`src/pages/`** — Three-step page components (`ScenarioPage`, `AvatarPage`, `SessionPage`).
- **`src/components/`** — Shared UI: `DebugPanel`, `ErrorBoundary`, `LabeledInput`.
- **`src/env.ts`** — Single source of truth for `VITE_*` environment variables.

No automated UI tests are included — this is an internal developer tooling console.
