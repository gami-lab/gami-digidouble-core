# Title

Type The GM Decision Payload, Audit Tool Contracts, And Fix Cost Reporting

# Context

12.4 asserts on Game Master decisions read from recorded events. Today the admin events DTO carries
`payload: Record<string, unknown>`; the evaluation tool, the console timeline, and Core each
interpret `gm_triggered.decision` on their own. Building GM assertions on that would add a fourth
reader. The EPIC also reports `totalCostUsd` as null although per-run estimates exist in
`reports/luna-full-2026-10-05.json`. Both are fixed here before any new evaluation feature.

# Scope

Implement now:

- a shared, typed projection of the recorded GM decision (`packages/shared/src/`, existing runtime
  inspector owner or a focused module): routing action and target, unlocked avatar ids, dialogue
  mode and `askFollowUp`, director notes, progression update, retrieval plan summary, media cue
  outcome, model, tokens, latency
- Core builds the `gm_triggered` payload from that type (`run-game-master.events.ts`); console and
  the evaluation tool read it through one shared guard instead of local casts
- audit `tools/conversation-evaluation/src/contracts.ts` and `core-api-contracts.ts` for shapes
  that duplicate `@gami/shared` DTOs; replace duplicates with shared types and keep only
  tool-owned report/definition types locally
- find where `totalCostUsd` is null (per-message `costUsd` from Core metadata via
  `metrics.ts:normalizeCostUsd`, the comparison aggregate in `comparison.ts`, or the viewer), fix it
  at its source, and add a regression test reproducing the null

Out of scope:

- definition v2 and new assertions (prompts `01`–`04`)

# Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` (Diagnostics)
- `docs/API_CONTRACT.md` (admin events)
- `docs/TEST_STRATEGY.md`
- `tools/conversation-evaluation/README.md`

# Implementation Guidance

- `rg "gm_triggered|decision\[|payload\['decision'\]" apps packages tools` to list every reader.
- Keep the payload bounded: no prompts, no raw provider output, director notes as already recorded.
- Changing the payload shape is allowed (prototype rule); update console timeline mapping and tests
  in the same change.
- The cost regression test uses a fixed report fixture, not live providers.

# Constraints

- No new dependency.
- Bounded diagnostics only; no secrets or raw prompts in events.

# Deliverables

- typed shared GM decision projection and guard; Core, console, and tool use it
- tool contract duplication removed
- cost reporting fixed with a regression test

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (GM events, admin events DTO, tool report types).
2. Search for duplicated type definitions across Core, console, and the evaluation tool.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/GAME_MASTER_CONTRACT.md` (recorded decision shape)
- `docs/API_CONTRACT.md` (canonical owner list)
- `tools/conversation-evaluation/README.md` (cost reporting)

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] `gm_triggered.decision` has one shared typed owner used by Core, console, and the tool.
- [ ] The tool no longer redeclares shared DTOs.
- [ ] Cost is non-null whenever every model used has a price; a regression test covers it.
- [ ] Documentation reviewed and updated.
