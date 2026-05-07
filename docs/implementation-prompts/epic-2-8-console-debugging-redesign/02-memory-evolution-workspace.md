# Memory Evolution Workspace

## Context

Memory understanding is central to debugging conversation quality. Operators need to see what the avatar currently "has in mind" and how that memory changed over exchanges.

## Scope

Implement now:

- Redesign memory section to explicitly separate:
  - short-term exchange memory
  - working memory (session + avatar)
  - long-term facts
- Add memory evolution view tied to turn/conversation progression.
- Highlight deltas between snapshots (added/removed/changed memory entries).

Out of scope:

- New memory algorithms or policy changes in core domain.
- Unbounded transcript playback.

## Relevant Docs

- docs/VISION.md
- docs/PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/DATA_MODEL.md
- docs/API_CONTRACT.md
- docs/GAME_MASTER_CONTRACT.md
- docs/TEST_STRATEGY.md
- docs/PROJECT_STATUS.md

## Implementation Guidance

- Reuse existing memory endpoints and composed runtime inspector model first.
- If evolution cannot be derived cleanly from existing APIs, add the smallest bounded backend extension and document contract changes.
- Keep memory visuals deterministic and bounded.
- Provide operator copy that explains implications (for example "working memory stale", "new long-term fact extracted").

## Constraints

- No secret/provider payload exposure.
- No duplicated memory DTO definitions in console.
- Keep UI signal-first: fewer widgets, more meaningful state transitions.

## Deliverables

- Memory workspace redesign and evolution timeline/delta panel.
- Tests proving memory section renders layered state and evolution behavior.
- Any needed contract/test additions if backend extension is required.

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
- docs/API_CONTRACT.md (if endpoint behavior/shape changed)
- docs/DATA_MODEL.md (if memory read model changed)

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- [ ] Memory section clearly separates short-term, working, and long-term state.
- [ ] Operators can see memory evolution over turns.
- [ ] Deltas are explicit and bounded.
- [ ] Tests verify observable memory debugging behavior.
- [ ] Documentation is synchronized.
