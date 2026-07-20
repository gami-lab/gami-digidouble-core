# EPIC 8.2 - Runtime Context Assembly Refactoring

## Objective

Refactor runtime Avatar context assembly so current-turn instructions are visible before transient state, world and retrieved context, and stable avatar identity. Consume the fixed `computedTraits` contract from EPIC 8.1 without regenerating or redesigning those traits.

Generated: 2026-07-19

## Execution Order

| Order | Prompt                                               | Outcome                                                                                                |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1     | `00-runtime-context-contract-baseline.md`            | Confirm canonical ownership and remove contract-drift risks before changing runtime context.           |
| 2     | `01-structured-context-sections-and-precedence.md`   | Define the internal structured runtime sections and deterministic precedence model.                    |
| 3     | `02-avatar-prompt-assembly-and-trait-consumption.md` | Assemble the Avatar prompt in EPIC 8.2 order and consume `computedTraits` with compatibility fallback. |
| 4     | `03-send-message-and-runtime-inspection-wiring.md`   | Wire the refactored assembly through the normal turn path and keep runtime diagnostics aligned.        |
| 5     | `04-tests-hardening-and-doc-sync.md`                 | Close regression gaps, verify compatibility, and synchronize source-of-truth documentation.            |

## Dependencies

- EPIC 8.1 must provide the stable seven-field `computedTraits` contract and persistence/read path before the preferred trait path can be exercised.
- Prompt 00 precedes all implementation prompts because Avatar, context snapshots, trace DTOs, and local test shapes are high-fanout contracts.
- Prompt 01 establishes the structured context inputs consumed by Prompts 02 and 03.
- Prompt 02 changes the prompt string order; Prompt 03 verifies that the production send-message path supplies all required inputs.
- Prompt 04 assumes the complete runtime path exists and should be the final implementation slice.

## Suggested Execution

Run the prompts in order. Keep each slice small enough to review independently. If EPIC 8.1 is incomplete, implement the compatibility path first and leave the trait-preferred assertions explicitly blocked until the shared `computedTraits` contract is available.

## Definition Of Done

- [x] Runtime context follows the target order: Director Notes, Response Rules, Conversation State, User Persona, World Context, Retrieved Context, Avatar Traits.
- [x] `computedTraits` is the preferred Avatar identity input when present.
- [x] Avatars without computed traits continue to use the existing authored persona as a compatibility fallback.
- [x] Conversation state, world context, retrieved context, and avatar traits remain semantically separate.
- [x] Context selection remains deterministic, bounded, and inspectable.
- [x] Existing Avatar behavior and non-trait runtime inputs are preserved unless the EPIC explicitly changes their order.
- [x] Tests cover ordering, fallback, trait consumption, token-budget behavior, and no-sensitive-content observability.
- [x] `docs/PROJECT_STATUS.md` and all impacted architecture, contract, data-model, epic, and testing documentation are accurate.
