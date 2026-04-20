# 05 — Debug Metadata, Hardening & Documentation Sync

## Context

Each avatar message returned by the Core carries a `metadata` block with observability data:
`model`, `latencyMs`, `inputTokens`, `outputTokens`. This prompt surfaces that data in the UI
as a collapsible debug panel per message — this is the main diagnostic value of the console
for developers and QA operators.

This prompt also hardens global error handling, validates the complete build pipeline, and
synchronises all project documentation to reflect EPIC 2.4 as complete.

---

## Scope

**In scope**

- Per-message collapsible debug panel showing metadata fields when present
- Global error boundary: React `ErrorBoundary` component catching unhandled component errors
- Document sync: `PROJECT_STATUS.md`, `TECH_STACK.md`, `ARCHITECTURE.md`
- Final end-to-end validation: `pnpm typecheck`, `pnpm lint`, `pnpm build`

**Out of scope**

- Persisting debug data across sessions
- Charting / aggregating latency or token metrics
- Exporting logs or conversation transcripts
- Automated UI tests (EPIC 2.4 console is an internal tool; manual validation is sufficient)

---

## Relevant Docs

- `docs/API_CONTRACT.md` — `avatarMessage.metadata` shape
- `docs/PROJECT_STATUS.md` — update required
- `docs/TECH_STACK.md` — update required
- `docs/ARCHITECTURE.md` — update if needed

---

## Implementation Guidance

### Debug panel

Add a debug toggle to each avatar message rendered in the `SessionPage` message list.

Layout per avatar message:

```
┌─────────────────────────────────────────┐
│ Avatar: How can I help you today?        │
│ [▼ debug]                               │
│  ┌─ debug panel (shown when open) ────┐ │
│  │ model:        gpt-4o-mini          │ │
│  │ latency:      342 ms               │ │
│  │ input tokens: 127                  │ │
│  │ output tokens: 48                  │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

- Toggle button label: `[▼ debug]` (open) / `[▶ debug]` (closed)
- Only render the panel when `metadata` is non-null on the `LocalMessage`
- User messages have no debug panel
- History messages loaded via `getHistory` may or may not carry metadata — show the panel only when fields are present

### Metadata field rendering

```ts
interface DebugPanelProps {
  metadata: {
    model?: string
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
  }
}
```

Format:

- `latencyMs` displayed as `${latencyMs} ms`
- Missing optional fields omitted from the panel (not shown as "undefined")

### Global error boundary

Create `src/components/ErrorBoundary.tsx`:

- Class component implementing `componentDidCatch` + `getDerivedStateFromError`
- On error: render a full-width red banner with the error message and a "Reload" button
  (`window.location.reload()`)
- Wrap the entire `App` content in `<ErrorBoundary>` in `main.tsx`
- Catches React render errors — not a substitute for the `ApiError` handling already in each page

### `src/components/DebugPanel.tsx`

Extract the debug panel into its own component to keep `SessionPage` focused.

---

## Documentation Sync

### `docs/TECH_STACK.md`

Add a **Front-end (console)** section:

```markdown
## Front-end (Manual Test Console)

| Concern   | Choice                         | Notes                         |
| --------- | ------------------------------ | ----------------------------- |
| Framework | React 18                       | Via Vite template             |
| Bundler   | Vite                           | Dev server + production build |
| Language  | TypeScript (strict mode)       | Same tsconfig conventions     |
| Styling   | Inline styles / CSS modules    | No external CSS framework     |
| Env vars  | `VITE_API_URL`, `VITE_API_KEY` | Injected at dev time          |
```

### `docs/ARCHITECTURE.md`

If not already present, add a note under the module structure that `apps/console/` is a
**front-end consumer layer** — it calls the Core API and has no access to domain or
infrastructure modules. It is not part of the 4-layer backend architecture; it sits at the
same external-consumer level as any third-party API client.

### `docs/PROJECT_STATUS.md`

Mark **EPIC 2.4 — Manual Test Console v1** as complete:

- List the new package: `@gami/console`
- List implemented features: health check, scenario/avatar creation, session management, chat, history, reset, debug metadata panel, error boundary

---

## Final Validation

Run in order:

```bash
pnpm --filter @gami/console typecheck
pnpm --filter @gami/console lint
pnpm --filter @gami/console build
```

Then start the full local stack and perform a manual end-to-end test:

1. `docker compose up -d` (Core + Postgres + Redis)
2. `pnpm --filter @gami/console dev`
3. Open `http://localhost:5173`
4. Verify health check shows green
5. Create a scenario and avatar
6. Start a session and send several messages
7. Verify debug panel shows model, latency, token counts
8. Reset session and start a new one with the same scenario

---

## Constraints

- `ErrorBoundary` is a class component — React error boundaries require class components
- No automated UI tests required for EPIC 2.4
- Do not add any new `@gami/core` endpoints — the console is a pure consumer
- Strict TypeScript in `DebugPanel` props — `metadata` fields are all optional

---

## Deliverables

- `apps/console/src/components/DebugPanel.tsx`
- `apps/console/src/components/ErrorBoundary.tsx`
- `apps/console/src/pages/SessionPage.tsx` updated to use `DebugPanel`
- `apps/console/src/main.tsx` updated to wrap app in `ErrorBoundary`
- `docs/TECH_STACK.md` updated
- `docs/ARCHITECTURE.md` updated
- `docs/PROJECT_STATUS.md` updated — EPIC 2.4 marked complete

---

## Acceptance Criteria

- [ ] Avatar messages display a `[▶ debug]` toggle that expands to show metadata
- [ ] Debug panel shows only fields that are present (no "undefined" values)
- [ ] Global `ErrorBoundary` renders a red banner on unhandled component errors instead of a blank screen
- [ ] `pnpm typecheck` passes for `@gami/console`
- [ ] `pnpm lint` passes for `@gami/console`
- [ ] `pnpm build` succeeds for `@gami/console`
- [ ] Manual end-to-end test passes (scenario → avatar → session → chat → debug → reset)
- [ ] `docs/PROJECT_STATUS.md` lists EPIC 2.4 as complete
- [ ] `docs/TECH_STACK.md` has a front-end section
