# 04 — Console Admin UI

## Context

Prompts 01–03 deliver the backend endpoints. This prompt upgrades the console to consume them. The console currently supports create-only flows for scenarios and avatars, and a single-session conversation flow. After this prompt, operators can edit and delete scenarios, edit and delete avatars, list all sessions, and reset any session — all through the UI.

This is a frontend-only prompt. All APIs it calls must already exist (from prompts 01–03).

## Scope

**In scope:**

- `apps/console/src/api/scenarios.ts` — add `updateScenario()`, `deleteScenario()`, `deleteAvatar()`, `updateAvatar()`
- `apps/console/src/api/sessions.ts` — add `listSessions()`, `resetSession()`
- `apps/console/src/pages/ScenarioPage.tsx` — add inline edit + delete per scenario in list; add edit + delete per avatar in avatar list
- `apps/console/src/pages/AvatarPage.tsx` — add edit form and delete button per avatar
- `apps/console/src/pages/SessionPage.tsx` or a new `SessionListPage.tsx` — add session list view with scenario/status filter and per-session reset button

**Out of scope:**

- Backend endpoints (already done in 01–03)
- Pagination or infinite scroll
- Bulk operations
- Confirmation modals (a simple `window.confirm()` is sufficient for Phase A destructive actions)
- New routing infrastructure — use the existing page navigation pattern in `App.tsx`

## Relevant Docs

- `docs/API_CONTRACT.md` — shapes for all new and existing endpoints
- `apps/console/src/api/scenarios.ts` — existing API client functions to extend
- `apps/console/src/api/sessions.ts` — existing API client functions to extend
- `apps/console/src/pages/ScenarioPage.tsx` — existing scenario page to extend
- `apps/console/src/pages/AvatarPage.tsx` — existing avatar page to extend
- `apps/console/src/pages/SessionPage.tsx` — existing session page to extend
- `apps/console/src/pages/form-styles.ts` — shared style tokens
- `apps/console/src/App.tsx` — routing/page switching to understand navigation model

## Implementation Guidance

### API Client Extensions

#### `apps/console/src/api/scenarios.ts`

Add:

```ts
export async function updateScenario(
  scenarioId: string,
  updates: Partial<Pick<ScenarioSummary, 'name' | 'status'>>,
): Promise<ScenarioSummary>

export async function deleteScenario(scenarioId: string): Promise<void>

export async function updateAvatar(
  avatarId: string,
  updates: Partial<
    Pick<AvatarSummary, 'name' | 'personaPrompt' | 'tone' | 'description' | 'status'>
  >,
): Promise<AvatarSummary>

export async function deleteAvatar(avatarId: string): Promise<void>
```

Wire each to the correct `coreRequest()` call:

- `updateScenario` → `PATCH /v1/scenarios/{scenarioId}`
- `deleteScenario` → `DELETE /v1/scenarios/{scenarioId}`
- `updateAvatar` → `PATCH /v1/avatars/{avatarId}`
- `deleteAvatar` → `DELETE /v1/avatars/{avatarId}`

#### `apps/console/src/api/sessions.ts`

Add:

```ts
export async function listSessions(filter?: {
  scenarioId?: string
  userId?: string
  status?: string
}): Promise<SessionSummary[]>

export async function resetSession(sessionId: string): Promise<SessionSummary>
```

Wire to:

- `listSessions` → `GET /v1/sessions?scenarioId=...`
- `resetSession` → `POST /v1/sessions/{sessionId}/reset`

Remember to export new functions from `apps/console/src/api/index.ts`.

---

### Scenario Page — Edit + Delete

Extend `ScenarioPage.tsx` to show edit and delete actions inline in the scenario list.

**Pattern:**

- Each scenario row shows an **Edit** button and a **Delete** button
- **Edit**: clicking Edit puts that row into edit mode — shows an inline form pre-filled with `name` and `status`. Submit calls `updateScenario()`. Cancel exits edit mode without saving.
- **Delete**: clicking Delete calls `window.confirm('Delete scenario?')`. If confirmed, calls `deleteScenario()`. On success, removes the scenario from the local list. On `409 CONFLICT`, show an error message inline (e.g., "Cannot delete: scenario has avatars or active sessions.")

ESLint rule `max-lines-per-function` (100 lines) will fire if the component grows too large. Extract sub-components or helper functions proactively:

- `ScenarioRow` — renders one scenario with edit/delete
- `ScenarioEditForm` — inline edit form

---

### Avatar Page — Edit + Delete

Extend `AvatarPage.tsx` to show edit and delete actions per avatar in the list.

**Pattern:**

- Each avatar row shows an **Edit** button and a **Delete** button
- **Edit**: inline form pre-filled with `name`, `personaPrompt`, `tone`, `description`. Submit calls `updateAvatar()`. Cancel exits edit mode.
- **Delete**: `window.confirm()` → `deleteAvatar()`. On `409 CONFLICT`, show an error message ("Cannot delete: avatar has active sessions.")

Extract sub-components to stay within line limits:

- `AvatarRow` — renders one avatar with edit/delete
- `AvatarEditForm` — inline edit form

---

### Session Admin — List + Filter + Reset

The existing `SessionPage.tsx` is scoped to managing a single active session's conversation flow. Session administration (list all, filter, reset) is a distinct concern. Introduce a new component or page for it.

**Approach:** Add a `SessionAdminPanel` section that can be shown in the console alongside or instead of the flow-based session UI. Whether to integrate this into `SessionPage.tsx` or create a separate `SessionAdminPage.tsx` is a judgment call — choose whatever keeps existing functionality intact and avoids excessive line count.

**Session list view:**

- On mount, call `listSessions()` (optionally filtered by `scenarioId` if one is selected in context)
- Display a table/list showing: `sessionId` (truncated), `userId`, `status`, `lastActivityAt`
- **Filter** by `status` (dropdown: all / active / closed / archived)
- Each row has a **Reset** button
- **Reset**: `window.confirm('Reset session? This will clear all messages and conversations.')` → `resetSession(sessionId)`. On success, refresh the row to show updated status.

---

### Navigation Wiring

Ensure the new session admin view is reachable from `App.tsx`. If `App.tsx` uses a page-type navigation model (it does), add a `'session-admin'` page type or make the session admin panel accessible from the existing session flow page. Keep the change minimal.

---

### Exports

Ensure all new API functions are exported from `apps/console/src/api/index.ts`.

## Constraints

- ESLint `max-lines-per-function` is enforced at 100 lines — extract sub-components aggressively
- No new external UI libraries — use the existing inline style pattern from `form-styles.ts`
- Use `window.confirm()` for destructive action confirmations — no modal infrastructure needed
- Optimistic UI updates are fine for list removals on delete success; re-fetch after reset
- TypeScript strict — all new functions typed, no `any`
- Do not break the existing session conversation flow in `SessionPage.tsx`

## Deliverables

1. `apps/console/src/api/scenarios.ts` — `updateScenario()`, `deleteScenario()`, `updateAvatar()`, `deleteAvatar()` added
2. `apps/console/src/api/sessions.ts` — `listSessions()`, `resetSession()` added
3. `apps/console/src/api/index.ts` — new functions exported
4. `ScenarioPage.tsx` — inline edit and delete per scenario and per avatar
5. `AvatarPage.tsx` — inline edit and delete per avatar
6. Session admin view (panel or page) — list sessions with filter + reset per session
7. `App.tsx` — navigation updated to reach session admin view if a new page was added

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — note that the console now has full admin CRUD for scenarios, avatars, and sessions
- Verify `docs/API_CONTRACT.md` matches the exact field names used in the console API calls — field name drift between contract and client is a common bug

## Acceptance Criteria

- [ ] `updateScenario()`, `deleteScenario()`, `updateAvatar()`, `deleteAvatar()` implemented in console API client
- [ ] `listSessions()`, `resetSession()` implemented in console API client
- [ ] Scenario list shows Edit + Delete per row; edit works inline; delete requires confirm and shows conflict errors
- [ ] Avatar list shows Edit + Delete per row; edit works inline; delete requires confirm and shows conflict errors
- [ ] Session admin view lists all sessions; supports filter by status; each session row has a Reset button
- [ ] Reset requires confirm; on success session row refreshes; on error shows message
- [ ] Existing session conversation flow is unbroken
- [ ] `pnpm lint && pnpm typecheck` pass for the console app
