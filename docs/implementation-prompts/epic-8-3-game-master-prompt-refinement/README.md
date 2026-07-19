# EPIC 8.3 — Game Master Prompt Refinement

## Objective

Refine the Game Master prompt so it is clearer, more stable, and easier to maintain without changing Game Master runtime contracts, orchestration architecture, or API behavior.

## Generated

2026-07-19

## Execution Order

| Step | File                                                 | Description                                                                                          |
| ---- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1    | `00-gm-prompt-contract-baseline.md`                  | Audit the existing GM prompt path, remove contract-drift risks, and confirm canonical ownership.     |
| 2    | `01-structured-gm-system-prompt.md`                  | Rebuild the static GM system prompt into explicit sections for role, objectives, policy, and output. |
| 3    | `02-structured-gm-input-rendering.md`                | Replace the raw GM input dump with a deterministic, sectioned runtime rendering of current context.  |
| 4    | `03-decision-guidance-and-run-game-master-wiring.md` | Strengthen evidence-based decision guidance and wire the refined prompt path through the use case.   |
| 5    | `04-tests-hardening-and-doc-sync.md`                 | Close regression gaps, run quality gates, and synchronize source-of-truth documentation.             |

Each prompt depends on the previous one being complete.

## Dependencies

- EPIC 4.1 and later GM work must already provide the async post-turn `RunGameMasterUseCase`, GM state persistence, and output normalization path.
- EPIC 4.2b / 4.2c memory work must already provide the bounded memory inputs consumed by GM.
- EPIC 5.5 persona work must already provide optional `userPersona` injection into GM input.
- EPIC 8.2 context refactoring should remain unchanged by this EPIC; EPIC 8.3 refines only the GM prompt path.

## Suggested Execution Order

Run the prompts in numeric order.

Prompt 00 comes first because GM prompt refinement touches a high-fanout boundary: domain prompt assembly, run-game-master wiring, tests that currently inspect raw prompt input, and runtime diagnostics. Without an ownership baseline, the EPIC can easily create duplicate local shapes or test-only prompt contracts.

Prompt 01 should land before prompt 02 so the static system instructions are defined before the dynamic runtime input is reformatted.

Prompt 02 should land before prompt 03 because the decision-policy improvements need the final input layout to be meaningful and testable.

Prompt 04 is the final slice only after the full refined prompt path is in place.

## Definition of Done

- [ ] The Game Master system prompt is organized into explicit sections for role, objectives, decision policies, and output contract.
- [ ] The Game Master prompt makes it explicit that GM interprets the latest exchange, updates discussion state, decides progression, and never speaks directly to the user.
- [ ] Dynamic GM runtime input is rendered in clearly separated sections rather than one undifferentiated block.
- [ ] Static experience context and current discussion context are visibly distinct in the final GM prompt path.
- [ ] Decision guidance encourages evidence-based updates and avoids unnecessary unlocks, switches, and progression changes.
- [ ] The `GameMasterInput` and `GameMasterOutput` runtime contracts remain unchanged unless a documented contract-cleanup slice proves otherwise.
- [ ] Existing parsing, normalization, unlock validation, and event safety behavior remain intact.
- [ ] Focused deterministic tests cover prompt structure, input rendering, decision-policy guidance, and run-game-master integration.
- [ ] No new HTTP endpoint is introduced; therefore no new stack-e2e file is added unless scope changes.
- [ ] `docs/PROJECT_STATUS.md` and all impacted source-of-truth docs are updated before the EPIC is considered complete.
