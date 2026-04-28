# 05 — Console GM Debug Panel in Scenario Test Bench

## Context

The Scenario Test Bench (`ScenarioTestPage.tsx`) is the primary manual testing surface for the
platform. Operators send messages and observe avatar responses, but the GM side is currently a
black box: there is no visible indication of whether the GM triggered, which avatar is active
according to the GM state, what notes were injected, or when a transition occurred.

This prompt adds a GM Debug Panel component to the Test Bench that automatically refreshes after
each message turn, displaying the operational state returned by the two admin endpoints.

## Scope

### In scope

- New `GmDebugPanel` component in the console
- Integration into `ScenarioTestPage.tsx` — displayed alongside the chat panel
- Two API calls after each sent message: `inspectSession` and `listSessionEvents`
- Display: active avatar, unlocked avatars, GM notes, transition history, recent GM events
- Manual "Refresh" button
- Loading and error states for the panel
- Console API client functions (`inspectSession`, `listSessionEvents`) in `apps/console/src/api/`

### Out of scope

- Real-time / WebSocket push — polling after each turn is sufficient for Phase A
- Editing GM state from the panel
- Filtering or searching events from the panel
- Multi-session comparison

## Relevant Docs

- `apps/console/src/pages/ScenarioTestPage.tsx` — current Test Bench implementation
- `apps/console/src/pages/scenario-test-state.ts` — state model pattern
- `apps/console/src/components/ScenarioTestLayout.tsx` — layout component
- `docs/API_CONTRACT.md` — inspect and events endpoint contracts (added in prompts 02 and 03)
- `docs/GAME_MASTER_CONTRACT.md` §6 — GM state fields
- `docs/TECH_STACK.md` — React + Vite, no external UI libraries beyond Tailwind if present

## Implementation Guidance

### Console API client

Add to `apps/console/src/api/`:

```ts
// In sessions.ts or a new admin.ts file

type SessionInspect = {
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

type GmEventSummary = {
  type: 'gm_triggered' | 'gm_skipped'
  correlationId: string
  createdAt: string
  payload: { triggerReason: string; turnIndex: number; interactionCount: number; latencyMs: number }
}

async function inspectSession(sessionId: string): Promise<SessionInspect>
async function listSessionEvents(
  sessionId: string,
  opts?: { limit?: number },
): Promise<GmEventSummary[]>
```

Export both from `apps/console/src/api/index.ts`.

### GmDebugPanel component

Create `apps/console/src/components/GmDebugPanel.tsx`.

Props:

```ts
type GmDebugPanelProps = {
  sessionId: string | null // null = no active session; panel shows placeholder
}
```

State:

- `inspect: SessionInspect | null`
- `events: GmEventSummary[]`
- `loading: boolean`
- `error: string | null`

On mount and when `sessionId` changes:

- if `sessionId` is null, render placeholder ("No active session")
- else call `inspectSession` + `listSessionEvents({ limit: 20 })` in parallel
- update state

Expose a `refresh()` function via `useImperativeHandle` or a `refreshTrigger: number` prop
(increment to trigger a re-fetch) so `ScenarioTestPage` can trigger refresh after each turn.

Display sections (simple, no animations):

1. **Active Avatar** — `inspect.gmState?.currentAvatarId ?? inspect.session.activeAvatarId ?? '—'`
2. **Unlocked Avatars** — `inspect.unlockedAvatarIds` as a comma-separated list or `'none'`
3. **GM Notes** — `inspect.gmNotes ?? '—'`
4. **Transition History** — ordered list of `fromAvatarId → toAvatarId (reason, startedBy, timestamp)`
5. **Recent GM Events** — table/list of `[timestamp] [type] [triggerReason] [latencyMs ms]`

### Integration into ScenarioTestPage

- Add a `gmRefreshTrigger` counter to `ScenarioTestPage` state (starts at 0)
- After each successful message send, increment `gmRefreshTrigger`
- Render `<GmDebugPanel sessionId={state.session?.sessionId ?? null} refreshTrigger={gmRefreshTrigger} />`
  in a collapsible panel or sidebar (below or beside the chat area)
- Add a "GM Debug" toggle button to show/hide the panel (collapsed by default)

### Collapsible toggle

Keep the GM panel collapsed by default so it does not clutter the main test bench. A simple boolean
`showGmPanel` in local component state is sufficient — no need for a global store.

## Constraints

- Do not modify `ScenarioTestState` domain model — this is UI-only state
- No external state management library — use `useState` / `useReducer` as the rest of the console does
- Keep `GmDebugPanel` stateless with respect to session logic — it only reads from the API
- Errors in the debug panel must not break the main chat functionality
- Max function length 100 lines — split large render functions into named sub-components
- Console uses React + Vite + TypeScript strict mode

## Deliverables

- `apps/console/src/api/admin.ts` (or additions to `sessions.ts`) — `inspectSession`, `listSessionEvents`
- `apps/console/src/components/GmDebugPanel.tsx`
- `ScenarioTestPage.tsx` updated to mount `GmDebugPanel` and pass refresh trigger

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — note GM Debug Panel added to console under EPIC 2.6
- Verify `docs/API_CONTRACT.md` inspect and events contracts are already updated (from prompts 02/03)

## Acceptance Criteria

- [ ] `inspectSession` and `listSessionEvents` functions in console API client
- [ ] `GmDebugPanel` renders all five display sections
- [ ] Panel shows placeholder when no session is active
- [ ] Panel refreshes after each message turn
- [ ] Manual Refresh button works
- [ ] Panel is collapsed by default; toggle shows/hides it
- [ ] Errors in the panel do not crash the chat interface
- [ ] `pnpm --filter @gami/console lint && pnpm --filter @gami/console typecheck` pass
