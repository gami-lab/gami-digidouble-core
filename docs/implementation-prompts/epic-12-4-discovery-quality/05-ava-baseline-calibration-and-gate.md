# Title

Build The AVA Suite, Calibrate The Judge, And Add The Regression Gate

# Context

The tooling now measures every row of the EPIC table. This slice turns it into an AVA quality bar:
a suite covering all seven rows, a judge whose scores agree with humans, a recorded baseline, and a
gate that flags regressions. No prompt is tuned yet.

# Scope

Implement now:

- AVA suite in `definitions/` (French): convert/extend the Max suite and add the other configured
  AVA characters (check the live scenario for which are active), covering:
  1. film facts (existing questions)
  2. persona and register (deterministic defaults + `in_character` rubric)
  3. revelation pacing (`secrets[]`, `not_revealed_before`, `max_secrets_per_turn`, pacing rubric;
     includes a first-turn "tell me everything" probe)
  4. guidance when stalled (silence/"je ne sais pas" turns; `gm_dialogue_mode` `avatar_guided`;
     stall-guidance rubric)
  5. GM decisions (routing/unlock expectations for the scenario's progression)
  6. long-session coherence (30-turn script) and avatar switch
  7. robustness probes
- golden set review: export the suite as a readable checklist (secrets, expected unlock points)
  for review with Paradigma; record the review outcome in the suite notes
- judge calibration: pick ten sessions (mix of scripted and simulated), have them human-rated in
  the viewer (extend human review to rubric scores), compute agreement (exact and ±1 for rubric,
  pass/fail agreement for facts), store the calibration report; adjust rubric anchors until
  agreement meets a stated target, and record the final anchors' version
- baseline: run the suite with 5 repetitions on the current production model configuration;
  store it as `reports/baseline-ava-<date>.json`
- regression gate: `compare --baseline <file> --candidate <file>` prints per-family deltas and
  exits non-zero when a family mean drops more than its threshold (configurable, with defaults)

Out of scope:

- changing Avatar/GM prompts, models, or retrieval (prompt `06`)

# Relevant Docs

- `tools/conversation-evaluation/README.md`
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md` (12.4)

# Implementation Guidance

- Reports may contain conversation transcripts of a fictional scenario; they must not contain
  secrets, service keys, or personal data. Keep baseline and calibration reports in
  `tools/conversation-evaluation/reports/` only if the repository already tracks reports there;
  otherwise store a compact summary and keep full reports local.
- The gate compares families separately; a facts gain must not hide a pacing drop.
- Tests: comparison/gate logic on fixture reports (drop beyond threshold fails, within passes,
  missing family handled), agreement computation.

# Constraints

- Baseline uses exactly the configuration currently deployed; record model selectors and Core
  commit in the report.
- Human ratings are made by people, never generated.

# Deliverables

- AVA v2 suite covering seven rows
- calibration report with agreement numbers and rubric anchor version
- baseline report (or summary) with 5 repetitions and cost
- compare/gate command with tests

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (report types, human review shape).
2. Search for duplicated type definitions inside the tool.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (baseline numbers)
- `tools/conversation-evaluation/README.md` (suite, calibration, gate)
- `docs/TEST_STRATEGY.md` (quality bar and gate usage)

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] The AVA suite covers all seven rows.
- [ ] Judge agreement with ten human-rated sessions is recorded and meets the stated target.
- [ ] A five-repetition baseline with cost is recorded.
- [ ] The gate flags a regression in any family.
- [ ] Documentation reviewed and updated.
