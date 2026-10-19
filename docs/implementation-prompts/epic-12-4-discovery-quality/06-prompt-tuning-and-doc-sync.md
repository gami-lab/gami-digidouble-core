# Title

Tune Avatar, GM, And Retrieval One Change At A Time, Then Sync Docs

# Context

With a baseline and a gate, tuning becomes evidence-based. This slice runs the tuning loop on the
weakest families from the baseline (pacing first: Max dumped three secrets in one reply), absorbs
the remaining progression tuning from 5.4, and writes the "before/after report per prompt change"
rule into the test strategy.

# Scope

Implement now, as a sequence of small commits, each with its own before/after report:

- revelation pacing: Avatar persona-prompt rules for gradual disclosure (one new element per reply,
  answer what was asked, hold back the rest) in `apps/core/src/domain/avatar/persona-prompt.service.ts`
  or authored AVA persona text, whichever owns the behavior; prefer authored scenario content when
  the rule is story-specific and Core prompt rules when it is general
- stall guidance: GM decision policy for `avatar_guided` after stalls and director notes that offer
  one concrete in-world hook; Avatar follow-through on `askFollowUp`
- GM progression/unlock pacing for AVA (from 5.4): unlock timing that matches the authored story
- retrieval parameters (`maxChunks`, `minimumChunksBySource`) if facts or pacing results point to
  retrieval rather than prompting
- after each change: run the affected scripts (5 repetitions), then the full suite before merging a
  batch; keep a change only if its target family improves and the gate passes
- tuning log: a short table in this pack (`tuning-log.md`): change, commit, target family, before,
  after, kept/reverted
- docs: `docs/TEST_STRATEGY.md` states that every Avatar/GM prompt change ships with a before/after
  report and passes the gate; `docs/GAME_MASTER_CONTRACT.md` updated for any policy change;
  `docs/PROJECT_STATUS.md` and `docs/EPICS.md` record 12.4 as done with the final numbers

Out of scope:

- model switches for latency (EPIC 12.5); only change models here if a report shows a quality gain
  at acceptable cost, and record it

# Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` (prompt structure rules)
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`, `docs/EPICS.md`
- `tools/conversation-evaluation/README.md`

# Implementation Guidance

- One variable per report. If two changes are needed together, say why in the tuning log.
- Update Core prompt unit/snapshot tests with each prompt change; tests assert structure and rules,
  not writing quality.
- Keep reverted experiments out of the codebase; their reports stay in the log.

# Constraints

- Comment policy: no comments in prompts or code that narrate tuning history.
- No GM blocking or synchronous changes; Avatar responds directly.
- Bounded diagnostics unchanged.

# Deliverables

- tuned prompts/policies/parameters, each with before/after reports
- `tuning-log.md`
- final AVA report versus baseline
- synchronized docs; 12.4 marked done

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (persona prompt, GM prompt, retrieval defaults).
2. Search for duplicated prompt rules between Core prompt services and authored scenario content.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (12.4 shipped, final numbers)
- `docs/EPICS.md` (12.4 marked done; 5.4 absorbed scope closed)
- `docs/TEST_STRATEGY.md` (before/after rule, gate)
- `docs/GAME_MASTER_CONTRACT.md` (policy changes)
- `docs/TEST_COVERAGE_PLAN.md`, `tools/conversation-evaluation/README.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Every prompt change in this EPIC has a before/after report in the tuning log.
- [ ] Pacing no longer allows multiple secrets in one reply on the AVA suite (reported numbers).
- [ ] The final suite passes the gate against the baseline.
- [ ] The before/after rule is in `docs/TEST_STRATEGY.md`.
- [ ] All impacted docs synchronized and 12.4 marked done.
