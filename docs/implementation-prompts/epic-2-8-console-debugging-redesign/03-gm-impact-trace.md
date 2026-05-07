# GM Impact Trace And Causality

## Context

GM behavior is a core differentiator, but current visibility does not make cause and effect easy to understand. Operators need to see what GM did, why, and how it impacted the user flow.

## Scope

Implement now:

- Redesign GM section to show a causality trace:
  - trigger/context
  - GM decision/action
  - resulting system/user impact
- Make key impacts explicit:
  - avatar unlocks
  - routing/switch suggestions
  - directives/notes injection
- Correlate GM entries with turn index and timeline position.

Out of scope:

- Changing GM decision logic itself.
- Deep model-output diagnostics beyond existing safe contracts.

## Relevant Docs

- docs/VISION.md
- docs/PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/API_CONTRACT.md
- docs/GAME_MASTER_CONTRACT.md
- docs/TEST_STRATEGY.md
- docs/PROJECT_STATUS.md

## Implementation Guidance

- Build trace from existing events/inspect/context data first.
- Use correlationId/turnIndex when available to map impact chain.
- If critical causality data is missing, add minimal bounded fields through canonical shared contracts.
- Prioritize readability over raw event volume.

## Constraints

- Avoid introducing duplicated GM DTOs in console.
- Keep user-facing impact statements concrete and deterministic.
- Maintain security posture: no credentials, raw prompts, or provider internals.

## Deliverables

- New GM impact trace UI section with causality mapping.
- Tests verifying causality rendering for representative GM events.
- Any endpoint/contract additions include route tests and stack-e2e files when applicable.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- docs/PROJECT_STATUS.md
- docs/API_CONTRACT.md (if shape changed)
- docs/GAME_MASTER_CONTRACT.md (if debug-visible GM fields changed)

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- [ ] GM actions are shown with trigger and impact chain.
- [ ] Unlock/routing/directive impacts are clearly visible.
- [ ] Causality is tied to timeline metadata (turn or correlation).
- [ ] Tests cover observable GM trace behavior.
- [ ] Docs are synchronized.
