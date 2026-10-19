# Title

Add Rubric Scores And Game Master Assertions

# Context

Being in character, pacing a revelation well, and relaunching a stalled visitor are judgments, not
string checks. The Game Master's choices (route, unlock, dialogue mode, director notes) are
recorded but never asserted. This slice adds a rubric judge with 1–5 scores and GM assertions read
from recorded events.

# Scope

Implement now:

- rubric assertions (LLM judge, existing raw exchange path and judge model):
  - `rubric` with `criterion` ∈ `in_character`, `pacing`, `guidance_when_stalled`, plus
    optional author notes; returns score 1–5, a one-sentence rationale, and pass/fail against a
    `minScore`
  - per-turn and script-level (whole transcript) variants; pacing is normally script-level
  - rubric anchors (what 1, 3, and 5 mean) stored in the tool, versioned, and printed in reports
- GM assertions from the typed `gm_triggered` decision (prompt `00`) and runtime events for the
  turn's correlation id:
  - `gm_routing` (`stay` / `suggest` / `switch` / `unlock` and optional target avatar name)
  - `gm_unlock` (avatar unlocked by turn N, or not unlocked before turn N)
  - `gm_dialogue_mode` (expected mode or set of modes; e.g. `avatar_guided` after a stall)
  - `gm_director_note_adherence`: rubric judge compares the next Avatar reply with the director
    note recorded for it (score 1–5)
- wait for the GM run of a turn to be recorded before evaluating GM assertions (poll events with a
  bounded timeout; report `gm_missing` as an infrastructure outcome, not a quality failure)
- judge retries reuse the existing three-attempt policy; malformed scores are `judge_error`

Out of scope:

- judge calibration (prompt `05`), simulated visitor (prompt `04`)

# Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md`
- `tools/conversation-evaluation/README.md`
- `docs/TEST_STRATEGY.md`

# Implementation Guidance

- Extend `src/judge.ts` with a rubric prompt and a strict JSON result guard; keep the facts judge
  unchanged.
- GM assertions are pure functions over the typed decision; only adherence calls the judge.
- Map avatar names to ids once per run (existing `resolveInitialAvatarId` pattern).
- Tests: rubric result parsing and threshold logic with a fake judge; GM assertions on recorded
  event fixtures (switch, unlock, no decision, missing GM run); adherence with a fake judge.

# Constraints

- The judge never sees secrets beyond what the definition and transcript contain.
- Rubric scores are reported separately from facts pass rate; no blended single score.

# Deliverables

- rubric judge and assertion types
- GM assertion types reading recorded events
- report and viewer sections for rubric scores and GM results
- unit tests with fakes and fixtures

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (GM decision projection, admin events DTO, judge contracts).
2. Search for duplicated type definitions inside the tool.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `tools/conversation-evaluation/README.md` (rubric anchors, GM assertions)
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Rubric scores 1–5 with rationale for in-character, pacing, and stall guidance.
- [ ] GM routing, unlock, dialogue mode, and director-note adherence are asserted from events.
- [ ] Missing GM runs are reported as infrastructure outcomes.
- [ ] Documentation reviewed and updated.
