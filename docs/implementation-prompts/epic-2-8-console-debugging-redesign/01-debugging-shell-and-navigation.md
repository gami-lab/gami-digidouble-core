# Unified Debugging Shell And Navigation

## Context

The current console flow is hard to follow. Operators need one coherent shell that mirrors how debugging is done in practice, without hopping between legacy pages and mixed responsibilities.

## Scope

Implement now:

- Create one debugging shell layout with clear top-level sections:
  - Session Setup
  - Memory
  - GM Impact
  - Turn Profiler
  - Persona
- Make this shell the default path for debugging from scenario selection.
- Remove noisy or duplicate navigation choices that lead to stale debugging routes.

Out of scope:

- Deep implementation of each debugging section content (next prompts).

## Relevant Docs

- docs/VISION.md
- docs/PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/TECH_STACK.md
- docs/API_CONTRACT.md
- docs/TEST_STRATEGY.md
- docs/EPICS.md
- docs/PROJECT_STATUS.md

## Implementation Guidance

- Keep the shell composition in small components/hooks; avoid monolithic page components.
- Preserve existing API integration points while redesigning navigation and composition.
- Add clear empty/loading/error states that explain next debugging actions.
- Keep one source of truth for selected scenario/session context.

## Constraints

- Preserve React + Vite + TypeScript strict patterns already used.
- Avoid introducing new state libraries unless absolutely necessary.
- Keep legacy routes only if they are required by active tests; otherwise remove.

## Deliverables

- New debugging shell component structure and navigation wiring.
- Migration of existing runtime inspector entry into this shell.
- Updated tests for navigation and state handoff between sections.

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
- docs/ARCHITECTURE.md (console module/shell boundaries)

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- [ ] One clear debugging shell is available and discoverable.
- [ ] Navigation no longer exposes stale or redundant debug paths.
- [ ] Session/scenario context is consistent across sections.
- [ ] Tests cover navigation and context continuity.
- [ ] Documentation is synchronized.
