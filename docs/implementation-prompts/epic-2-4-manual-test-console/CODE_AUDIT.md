# Code Audit — EPIC 2.4: Manual Test Console v1

**Auditor:** AI Staff Engineer review  
**Date:** 2025-07-09 (revised: 2026-04-21)  
**Scope package:** `@gami/console` (`apps/console/`)  
**Core package audited for contract alignment:** `@gami/core` (`apps/core/`)

---

## Scope Audited

- `apps/console/src/` — all source files
- `apps/console/package.json`, `vite.config.ts`, `tsconfig.json`
- Core API contract (`docs/API_CONTRACT.md`) compared against console client types
- EPIC README DoD checklist
- Cross-package import conventions (`packages/shared/`)

---

## Executive Summary

The console delivers a clean three-step page flow (Scenario → Avatar → Session), a typed API client with an `ApiError` abstraction, a collapsible DebugPanel, and an `ErrorBoundary` at the root. All toolchain checks pass cleanly and Core tests remain green.

The client type definitions align correctly with the Core API: scenario creation (`name`, `status?`, `config?`) and avatar creation (`name`, `personaPrompt`, `tone?`, `description?`, `adjustments?`, `config?`, `status?`) match the request body schemas in the Core routes exactly. `SessionPage` always provides `avatarId` as a concrete string when calling `sendMessage`, so the full scenario → avatar → session → chat flow is functionally reachable.

Remaining issues are architectural (an import path that bypasses the workspace package graph) and one type permissiveness mismatch. Neither blocks the primary flow.

---

## Final Grade

**B — Solid. Minor debt only. Close with debt after addressing F-01.**

---

## Build Health

| Check                                   | Result                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm --filter @gami/console lint`      | ✅ PASS                                                                   |
| `pnpm --filter @gami/console typecheck` | ✅ PASS                                                                   |
| `pnpm --filter @gami/console build`     | ✅ PASS (65 ms, 206 kB bundle)                                            |
| `pnpm --filter @gami/core test`         | ✅ PASS (178 tests / 32 files)                                            |
| `pnpm test:coverage`                    | Not configured for `@gami/console` — no automated UI tests per EPIC scope |

---

## Feature Confidence Matrix

| Feature                | Expected Behavior                                                                 | Evidence                                                                                               | Confidence | Notes                                                                                |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------ |
| API connectivity check | Health route reachable, API key skip for `/health`                                | `client.ts` `shouldInjectApiKey` correctly excludes `/health`                                          | Medium     | Not user-visible; no smoke test                                                      |
| Scenario creation      | User creates a named scenario, form posts `{name, status}` to Core, ID returned   | `ScenarioPage.tsx` fields and `CreateScenarioParams` match Core `CreateScenarioRequestBody` exactly    | Medium     | No automated test; behaviorally correct by inspection                                |
| Avatar creation        | User creates avatar with name, persona, tone, description; Core returns avatar ID | `AvatarPage.tsx` fields and `CreateAvatarParams` match Core `CreateAvatarRequestBody` exactly          | Medium     | No automated test; behaviorally correct by inspection                                |
| Session management     | Start, view history, reset session                                                | `sessions.ts` + `SessionPage.tsx` — logic present and correct                                          | Medium     | Depends on preceding steps completing successfully                                   |
| Chat interface         | Send message, receive avatar reply, render debug metadata                         | `messages.ts` + `SessionPage.tsx` + `DebugPanel.tsx`; `SessionPage` always provides `avatarId: string` | Medium     | `SendMessageParams.avatarId` typed optional (F-02) but always provided at call sites |
| Debug panel            | Expandable metadata per AI message (tokens, latency, model)                       | `DebugPanel.tsx` correctly guards missing fields, toggles state                                        | Medium     | Works in isolation; no integration evidence                                          |

---

## Strengths

- **Clean API client architecture.** `coreRequest<T>` is a solid typed base: envelope guard, network error capture, `ApiError` class with `code` + `status`. All domain modules (`scenarios.ts`, `sessions.ts`, `messages.ts`) compose it cleanly.
- **Strict TypeScript with no errors.** Zero errors across the entire package in strict mode.
- **ErrorBoundary at the root.** `<ErrorBoundary>` wraps `<App>` in `main.tsx`. `getDerivedStateFromError` + `componentDidCatch` are both implemented. Falls back to a red recovery banner.
- **Typed environment variables.** `env.ts` wraps `import.meta.env` with one canonical location; all modules import from it rather than reading `import.meta.env` directly.
- **DebugPanel handles edge cases.** Renders nothing when no debug data is present; each field is individually guarded; `null`/`undefined` safe.
- **StrictMode enabled.** Application is wrapped in `React.StrictMode` — double-render side-effect issues are caught early.
- **Zero lint warnings.** The codebase is already lint-clean; no suppression comments present.

---

## Findings

### F-01: `@gami/shared` imported via relative `.ts` path

- **Severity:** High
- **Category:** Architecture / workspace conventions
- **Problem:** `apps/console/src/api/client.ts` imports the `ApiResponse<T>` type as:
  ```ts
  import type { ApiResponse } from '../../../../packages/shared/src/api-response.ts'
  ```
  This bypasses the `@gami/shared` workspace package entirely, coupling the console to the internal file path structure of `packages/shared`.
- **Why it matters:** If `packages/shared` reorganizes its internals, the import silently breaks. It also means the console does not declare `@gami/shared` as a `dependencies` entry, making the dependency graph invisible to pnpm and tooling. `.ts` extension imports are not standard in module bundling contexts.
- **Evidence:** `apps/console/src/api/client.ts` line 1; `apps/console/package.json` has no `@gami/shared` dependency entry.
- **Recommendation:** Add `"@gami/shared": "workspace:*"` to `apps/console/package.json` dependencies. Change the import to `import type { ApiResponse } from '@gami/shared'`.

---

### F-02: `avatarId` typed optional in `SendMessageParams` but required by Core

- **Severity:** Medium
- **Category:** API contract alignment
- **Problem:** `apps/console/src/api/messages.ts` defines `SendMessageParams` with `avatarId?: string` (optional). The Core `POST /v1/conversations/:sessionId/messages` route validates `avatarId` as required (`type: 'string'` with no `required` omission).
- **Why it matters:** The type is more permissive than the contract allows. Any future call site that omits `avatarId` will silently compile and fail at runtime with `400`. In the current code, `SessionPage.tsx::submitSendMessage` always provides a concrete `avatarId: string` so the runtime behavior is correct — but the type does not enforce this.
- **Evidence:** `apps/console/src/api/messages.ts` `SendMessageParams`; `apps/core/src/api/routes/messages.ts` `MessagesRequestBody`.
- **Recommendation:** Change to `avatarId: string` (required) in `SendMessageParams`. If multi-avatar support is targeted later, document the relaxation at that point.

---

### F-03: Envelope error check precedes HTTP status check in `coreRequest`

- **Severity:** Low
- **Category:** Defensive programming / error handling
- **Problem:** In `client.ts`, after the envelope type guard passes, `coreRequest<T>` checks `payload.error !== null` before checking `response.ok`. If the server somehow returns a valid-shaped `ApiResponse` envelope with `error: null` but a non-2xx HTTP status, the final `!response.ok` guard would trigger and throw a generic `NETWORK_ERROR` rather than something meaningful.
- **Why it matters:** In practice, a correctly implemented server will never produce this combination. The `isApiResponseEnvelope` guard handles invalid-body cases cleanly. The risk is low but the code ordering is slightly misleading to future readers.
- **Evidence:** `apps/console/src/api/client.ts` — `if (payload.error !== null)` appears before `if (!response.ok)`.
- **Recommendation:** Add a brief comment explaining the intentional order, or swap to check `response.ok` first and derive the error from the envelope only when the status is non-2xx.

---

### F-04: No Vite proxy; CORS dependency not documented

- **Severity:** Low
- **Category:** Operational / deployment
- **Problem:** `vite.config.ts` has no `server.proxy` configuration. The console relies entirely on CORS headers from the Core (`CORS_ORIGIN` env var). No `base` path is set.
- **Why it matters:** The CORS dependency is an implicit operational requirement. A developer who starts the Core without `CORS_ORIGIN` configured will encounter silent network failures with no helpful error message. Sub-path deployment (e.g., `/console/`) is not supported without a `base` option.
- **Evidence:** `apps/console/vite.config.ts` — only `plugins: [react()]` present; `apps/core/.env.example` has `CORS_ORIGIN=*`.
- **Recommendation:** Add a `// NOTE: requires CORS_ORIGIN=* on Core` comment in `vite.config.ts` and document in the console README. Optionally add a dev proxy for local `pnpm dev` usage to eliminate the CORS requirement during development.

---

## Architecture Review

The console is a frontend-only application and does not participate in the Core's four-layer architecture. Evaluated on its own terms:

**Three-layer console structure (env → api → pages)** is clean and appropriate. `env.ts` → `api/*.ts` → `pages/*.tsx` is a single-direction dependency chain with no circular imports.

**The `api/` module** is well-structured. `client.ts` is the single HTTP adapter; all domain modules (`scenarios.ts`, `sessions.ts`, `messages.ts`) compose it without direct `fetch` calls. `ApiError` is the single error class used across all modules.

**Cross-cutting concerns** (`ErrorBoundary`, `DebugPanel`) are properly extracted as components rather than inlined in pages.

**The only architectural violation** is the direct relative import of `@gami/shared` types (Finding F-01). Everything else respects clean dependencies.

**State management** in `App.tsx` is handled via a single `TestContext` object passed as a prop. This is appropriate for the console's limited scope and avoids unnecessary complexity.

---

## Test Review

**No automated tests exist for `@gami/console`.** This was explicitly out of scope per the EPIC README, which states: _"No automated UI tests required for this MVP console."_

Per the project's `TEST_STRATEGY.md`, this exception is acceptable for a developer-internal tooling console, provided the primary behaviors are manually verified before closing the EPIC.

**What would high-confidence testing look like (for future reference):**

- Integration: mount `ScenarioPage` → assert form submits correct payload shape including `slug`
- Integration: mock `coreRequest` to return specific errors → assert `ErrorBoundary` and inline error states render correctly
- Unit: `formatApiError` parses all `ApiError` code variants
- Unit: `coreRequest` error ordering (F-04) — demonstrates the envelope-before-ok bug

**Missing tests on Core side:** The Core already has 178 tests covering scenario/avatar/session/message use cases. No gaps identified from the `@gami/core` audit.

---

## Documentation Gaps

1. **No `README.md` in `apps/console/`** — there is no developer setup guide explaining how to run the console, which env vars are required, or what the CORS dependency is.
2. **`PROJECT_STATUS.md`** should be updated to reflect EPIC 2.4 status (currently blocked at C/D).
3. **`API_GUIDE.md`** (written in a prior session) covers the Core API well; it should cross-reference the existence of the console as a quick-start tool once it is functional.

---

## Path to A

The following steps are required to reach an A grade:

### Blockers (must fix before close)

1. **Fix `@gami/shared` import path (F-01)** — add `"@gami/shared": "workspace:*"` to `apps/console/package.json` and update `client.ts` import to `import type { ApiResponse } from '@gami/shared'`.

### Improvements (recommended before final close)

2. **Fix `avatarId` optionality (F-02)** — make `avatarId: string` required in `SendMessageParams` to match the Core contract.
3. **Add a console `README.md`** — document setup, env vars, CORS requirement.
4. **Update `PROJECT_STATUS.md`** after EPIC is validated end-to-end.

### Not required for A

- Automated UI tests (explicitly out of EPIC scope)
- Vite proxy (CORS solution is acceptable)
- Sub-path deployment base path (out of scope for MVP console)

---

## Final Recommendation

**Close with debt.**

The primary functional flow is correct: scenario creation, avatar creation, session management, and chat all align with the Core API contract. Build, lint, typecheck, and Core tests all pass. The EPIC DoD is reachable.

The one meaningful issue before closing is F-01 (workspace package import path). It is a quick fix and should be done before merge. F-02 is low-risk type cleanup recommended alongside it. After those two changes and a manual end-to-end verification of the full flow, the EPIC can be closed.
