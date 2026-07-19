# Propagate Refined Working Memory Into GM And Debug Surfaces

## Context

EPIC 8.4 is only useful if the richer working memory actually reaches the Game Master and remains inspectable for operators. This slice wires the refined memory shape through existing consumers without changing GM ownership boundaries or adding new endpoints.

## Scope

Implement now:

- propagate `coveredTopics` through the GM memory-context assembly path;
- ensure GM prompt/input rendering can see covered topics alongside summary and unresolved threads;
- align admin/session-context and memory-inspection responses with the richer working-memory shape;
- update console/runtime-inspector and GM impact trace consumers so operator tooling can observe the new field.

Out of scope:

- redesigning GM state fields such as `topicsCovered`;
- adding new GM decision logic beyond consuming the refined working-memory input;
- adding new admin endpoints;
- visual redesign of console surfaces beyond the minimal changes needed to display the new data.

## Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.context-engine.ts`
- `apps/core/src/domain/game-master/gm-prompt.service.ts`
- `apps/core/src/api/routes/admin-session-context.ts`
- `apps/core/src/api/routes/admin-memory.ts`
- `apps/core/src/application/services/runtime-inspector-event-context.ts`
- `apps/console/src/components/runtime-inspector-tab-content.tsx`
- `apps/console/src/components/gm-impact-trace.ts`

## Implementation Guidance

- Keep the canonical memory source as the working-memory domain model and selected-memory payload. GM should consume that model; it should not invent a separate `coveredTopics` input shape.
- If GM currently uses a compatibility mirror such as `workingSummary`, preserve that mirror only as needed. The richer structured object should remain the source of truth.
- Make the GM input rendering explicit enough that covered topics are visible without forcing GM to extract them from the summary. Reuse the existing structured prompt path from EPIC 8.3 rather than bolting on an ad hoc string fragment.
- Align admin/debug surfaces with the same canonical field:
  - session-context response
  - memory inspector response/layers
  - recorded event-context snapshots if they expose current working memory
  - console runtime inspector and GM impact trace text
- Keep operator output bounded. Showing the list is useful; dumping raw prompt internals is not.
- Update tests that currently assert the old working-memory shape or old trace text.

## Constraints

Respect:

- no new endpoints;
- no prompt leakage into admin or event payloads;
- no divergence between GM runtime input and inspector-visible working-memory shape;
- no UI-only shadow contract for covered topics.

## Deliverables

- GM memory input path updated to include `coveredTopics`;
- aligned shared/admin DTO mapping for working-memory inspection;
- console/debug consumer updates for the richer memory shape;
- regression tests covering GM input and operator-visible inspection output.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/GAME_MASTER_CONTRACT.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

## Acceptance Criteria

- [ ] GM input can consume `coveredTopics` through the canonical working-memory structure.
- [ ] Existing GM/state ownership remains unchanged; `coveredTopics` does not become a new GM state field.
- [ ] Admin and runtime-inspector surfaces expose the richer working-memory shape consistently.
- [ ] Console/debug consumers render `coveredTopics` without introducing local shadow DTOs.
- [ ] No endpoint additions are required for this slice.
