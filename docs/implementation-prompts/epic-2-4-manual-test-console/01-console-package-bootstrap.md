# 01 — Console Package Bootstrap

## Context

EPIC 2.4 delivers a browser-based Manual Test Console. The Core (`apps/core/`) is headless
and API-first; it has no UI. A new `apps/console/` workspace package is required to host the
front-end. This prompt establishes the package, build tooling, Turborepo integration, and
a minimal connectivity check page that verifies the console can reach the Core API before any
feature is built.

Prompt 02 (API client layer) and all subsequent prompts build on top of this scaffold.

---

## Scope

**In scope**

- Create `apps/console/` as a new pnpm workspace package (`@gami/console`)
- Choose and configure the front-end tech stack: **Vite + React + TypeScript**
- Configure `tsconfig.json` aligned with project-wide strict TypeScript settings
- Wire `dev`, `build`, `typecheck`, `lint` scripts into Turborepo tasks
- Add a `.env.example` (and local `.env`) in `apps/console/` for:
  - `VITE_API_URL` — base URL of the running Core (default `http://localhost:3000`)
  - `VITE_API_KEY` — the Core API key (`e2e-stack-secret` for local Docker stack, `change_me_in_production` for local dev)
- Implement a single **Connectivity Check** page that:
  - Calls `GET /health` on the configured API URL
  - Displays: connected / not connected, API URL in use, Core version if exposed
  - Is the landing page; all other features will be added in later prompts

**Out of scope**

- Any scenario, avatar, session, or message UI (Prompts 03–05)
- Authentication UI — the console uses the API key from `.env` directly
- Production build configuration / Docker image for the console
- CSS frameworks or design systems beyond minimal readable layout

---

## Relevant Docs

- `docs/ARCHITECTURE.md` — headless core, external layers, module map
- `docs/TECH_STACK.md` — TypeScript-only constraint, Turborepo task conventions, quality rules
- `docs/API_CONTRACT.md` — `GET /health` shape, `ApiResponse<T>` envelope
- `docs/PRINCIPLES.md` — KISS, YAGNI, no premature abstractions

---

## Implementation Guidance

### Package setup

Create `apps/console/package.json` with:

- `name: "@gami/console"`
- `private: true`
- scripts: `dev`, `build`, `typecheck`, `lint`, `preview`
- dependencies: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`
- devDependencies: `typescript`, `@types/react`, `@types/react-dom`, `eslint`

Add `"apps/console"` to the root `pnpm-workspace.yaml` packages list.

### TypeScript config

`apps/console/tsconfig.json` should extend a `tsconfig.base.json` if one exists, or set at
minimum `strict: true`, `target: "ES2022"`, `lib: ["ES2022", "DOM"]`, `moduleResolution: "bundler"`.
Keep it aligned with the rest of the workspace's strict settings.

### Turborepo wiring

In `turbo.json`, the existing `dev`, `build`, `typecheck`, `lint` tasks already apply to all
packages — no new task definitions are needed. Verify `@gami/console` appears in the dependency
graph when running `pnpm build` from the root.

Vite builds output to `apps/console/dist/`. No `outputs` config needed in turbo.json beyond what
already exists for `build`.

### Environment config

`apps/console/.env.example`:

```
VITE_API_URL=http://localhost:3000
VITE_API_KEY=change_me_in_production
```

`apps/console/.env` (gitignored, created by developer):

```
VITE_API_URL=http://localhost:3000
VITE_API_KEY=e2e-stack-secret       # matches docker-compose.e2e.yml
```

In application code, read these via `import.meta.env.VITE_API_URL` and `import.meta.env.VITE_API_KEY`.

### Connectivity Check page

`src/App.tsx` (or `src/pages/ConnectivityCheck.tsx`):

```
┌──────────────────────────────────────────┐
│  Gami DigiDouble — Manual Test Console   │
│                                          │
│  API URL: http://localhost:3000          │
│  Status:  ● Connected  (or ✗ Unreachable)│
└──────────────────────────────────────────┘
```

Calls `GET <VITE_API_URL>/health` on mount. Shows loading state, then connected/unreachable.
The API key is NOT needed for `/health` — do not add `x-api-key` to this request.

No routing library at this stage — the whole app is one page. Routing is introduced in Prompt 03
if needed (keep it simple; a single-file state machine or minimal tabs may suffice over a full
router for an internal tool at this scale).

---

## Constraints

- TypeScript strict mode — no `any`, no implicit returns
- ESLint must pass with the project's existing flat config (extend it to cover `apps/console/`)
- Do not add a CSS framework — inline styles or a minimal CSS module is sufficient for an internal tool
- `VITE_API_KEY` must never be committed to source; `.env` must be in `.gitignore`
- No `console.log` left in production code

---

## Deliverables

- `apps/console/package.json`
- `apps/console/tsconfig.json`
- `apps/console/vite.config.ts`
- `apps/console/.env.example`
- `apps/console/.gitignore` (covering `.env` and `dist/`)
- `apps/console/index.html`
- `apps/console/src/main.tsx`
- `apps/console/src/App.tsx` — Connectivity Check page
- `apps/console/src/env.ts` — typed re-exports of `import.meta.env` values
- Root `pnpm-workspace.yaml` updated
- `.gitignore` at root updated if `apps/console/dist/` is not already covered

---

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — note that `apps/console/` package exists and scaffold is done (partial EPIC 2.4 progress)

Verify the following docs remain accurate (no changes expected):

- `docs/ARCHITECTURE.md` — the console is an external layer consuming the headless Core API, which is consistent with the architecture diagram
- `docs/TECH_STACK.md` — if Vite/React are not already listed, add them under a "Front-end (Console)" section

---

## Acceptance Criteria

- [ ] `pnpm install` succeeds from workspace root with the new package present
- [ ] `pnpm --filter @gami/console dev` starts a Vite dev server at `http://localhost:5173`
- [ ] Connectivity Check page renders in browser and calls `/health`
- [ ] When Core is running locally, page shows "Connected"
- [ ] When Core is not running, page shows "Unreachable" (does not crash or show blank screen)
- [ ] `pnpm typecheck` passes across the workspace (including `@gami/console`)
- [ ] `pnpm lint` passes across the workspace
- [ ] `pnpm build` succeeds for `@gami/console` (outputs to `apps/console/dist/`)
- [ ] `VITE_API_KEY` is absent from any committed file
