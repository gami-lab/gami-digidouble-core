# Console Debug Path Inventory (EPIC 2.8)

## Official primary debugging path (kept)

- Kept path: `Scenario -> Scenario Test Bench -> Session Runtime Inspector`
- Surface: `apps/console/src/components/RuntimeInspector.tsx` within `ScenarioTestLayout`
- Rationale: Single integrated debugging workspace for runtime state, memory, context, events, metrics, persona, and safe admin actions.

## Removed paths

- Removed path: per-message inline debug toggle in Session page conversation history
- Surface removed: `apps/console/src/components/DebugPanel.tsx` and its usage in `apps/console/src/pages/session-components.tsx`
- Rationale: Duplicated debugging intent with a narrower and inconsistent contract surface compared with Runtime Inspector.

## Redirected paths

- Redirected path: Session page conversation detail debug intent
- Redirect behavior: static operator guidance in `apps/console/src/pages/session-components.tsx` to use `Scenario Test Bench -> Session Runtime Inspector`
- Rationale: Preserve operator discoverability while preventing duplicate debug branches.
