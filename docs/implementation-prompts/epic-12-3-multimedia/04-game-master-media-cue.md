# Title

Let The Game Master Cue Media From The Scenario Catalogue

# Context

The research goal is for the director, not only fixed triggers, to cut to a prepared image or film
when the conversation calls for it. The GM already returns validated structured decisions; this
slice adds one optional decision, `mediaCue`, constrained to the scenario's cue-able assets.

# Scope

Implement now:

- GM input: a bounded catalogue of the scenario's `cueable` assets (`assetId`, kind, description),
  capped in count and description length; omitted entirely when there are none (no prose, field,
  or schema mention, matching how routing is omitted for single-avatar scenarios)
- GM output: optional `mediaCue: { assetId }` in the output schema and parser
- validation: the asset must be in the catalogue given to this GM run; anything else (unknown id,
  non-cue-able, other scenario, malformed) is dropped with a bounded diagnostic while every other
  GM decision is kept
- emission: an accepted cue goes through the cue service from prompt `03` with
  `origin: 'game_master'`; at most one GM cue per GM run
- repetition guard: the same asset is not cued twice in one session unless the author marks it
  repeatable (only add the flag if AVA needs it; otherwise "once per session")
- prompt guidance: short, concrete rule for when to cue (the conversation reaches the moment the
  description depicts), and that cueing is rare

Out of scope:

- media in Avatar prompts or Avatar output
- player rendering (prompt `05`)

# Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/MEMORY_SYSTEM_SPEC.md` (keep the catalogue out of memory)

# Implementation Guidance

- Files: `apps/core/src/domain/game-master/game-master.types.ts`, `gm-input-renderer.ts`,
  `gm-output-parser.ts`, `gm-output-normalization.ts`, `gm-prompt.service.ts`, and the run-GM use
  case. Follow the existing pattern for optional, conditionally present output sections.
- The catalogue is static scenario data, not memory or retrieval output; load it with the scenario.
- The cue is emitted after the GM run completes, so it arrives after the Avatar reply started; the
  player queues it (prompt `05`). Do not try to make the GM synchronous.
- GM replay (admin) must not emit a second cue for the same run (cue id from `03`).
- Tests:
  - unit: renderer includes/omits the catalogue; parser accepts valid cue, drops unknown/foreign/
    malformed cues while keeping other fields; repetition guard
  - application: accepted cue emits one `runtime.media_cue`; rejected cue emits nothing and the GM
    state reduction is unchanged
  - prompt snapshot tests updated where the repository already uses them

# Constraints

- Parser stays strict about required fields; `mediaCue` is optional only.
- No raw prompts or catalogue text in player-visible events or diagnostics beyond bounded ids.
- No change to dialogue control, routing, or progression semantics.

# Deliverables

- GM input catalogue, output field, parser/normalization, prompt guidance
- cue emission via the shared cue service
- unit and application tests

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (GM input/output types, GM event log entries).
2. Search for duplicated GM output shapes (console inspector, evaluation tool).
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/GAME_MASTER_CONTRACT.md` (inputs, `mediaCue` output, validation, prompt rules)
- `docs/ARCHITECTURE.md` if the GM flow description changes
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] GM sees a bounded cue-able catalogue only when one exists.
- [ ] Valid cues emit exactly one `runtime.media_cue` with `origin: 'game_master'`.
- [ ] Unknown, foreign, non-cue-able, or malformed cues are ignored without affecting the turn or
      other GM decisions.
- [ ] Documentation reviewed and updated.
