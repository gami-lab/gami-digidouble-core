# EPIC 12.4 — Discovery Quality & Measurement

## Objective

Tune the Avatar persona prompt, Game Master decision policies, and retrieval parameters against
measurements instead of impressions. Extend `tools/conversation-evaluation` from fact recall to the
whole discovery experience (persona, pacing, guidance, GM decisions, long-session coherence,
robustness), record an AVA baseline, and make every prompt change ship with a before/after report.

## Generated

2026-10-19

## Baseline

- `tools/conversation-evaluation` (EPIC 8.6) runs definition v1: a list of `questions` sent in
  order in **one** session/conversation (5 s settle wait), each judged by an LLM against
  `expectedResponse`, `requiredFacts`, `acceptedAlternatives`, `forbiddenClaims`.
- Multi-model comparison reports, `--append` repeats, an HTML viewer with human
  Accept/Partial/Reject review (`humanReview.originalStatus`), and Avatar/GM/memory token cost
  estimates per run already exist.
- The tool authenticates with `ADMIN_SERVICE_KEY` and gets player tokens from
  `POST /v1/admin/player-tokens` (12.1). It already reads `GET /v1/admin/sessions/{id}/events` for
  `runtime_usage`.
- `gm_triggered` event-log entries carry a `decision` (routing, unlocks, dialogue control, director
  notes, media cue), but the payload is `Record<string, unknown>` at the shared boundary.
- Max suite (`definitions/max-full*.json`, 21 questions) passes 16–18 of 21 over five
  `gpt-5.6-luna` runs (`reports/luna-full-2026-10-05.json`). Per-run cost estimates exist there,
  but the EPIC notes `totalCostUsd` as null somewhere in the reporting path: find and fix it.
- Not measured: persona/register, revelation pacing, guidance when stalled, GM decisions,
  long-session coherence, robustness. In a live test Max offered three secrets in his first reply.

## Design Decisions

- **Definition v2 replaces v1.** Existing definitions are converted, not kept alongside (prototype
  rule). A v2 definition is a list of scripts; a script is ordered turns; each turn has a user
  message (or a scripted action such as switch avatar / stay silent) and assertions.
- **Three assertion families, kept separate in reports:** deterministic (code, no LLM), rubric
  (LLM judge, 1–5 with rationale), GM (read from recorded `gm_triggered` and runtime events).
- **Repetitions are first-class.** A run executes each script N times (default 5) and reports
  mean, min/max, and standard deviation per assertion and per family.
- **Regression gate.** A comparison against a stored baseline report fails (non-zero exit) when a
  family's mean drops beyond a configured threshold. It runs locally/manually, not in default CI
  (it needs live providers).
- **Tuning is a separate, last step.** No prompt change happens before the baseline exists. One
  change per report; each prompt change commit references its before/after report.

## Ordered Execution List

| #   | File                                      | Purpose                                                                                     |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| 0   | `00-contract-cleanup.md`                  | Typed GM decision payload in shared; tool contract audit; fix null cost reporting           |
| 1   | `01-definition-v2-and-script-runner.md`   | v2 scripts, per-turn assertions, scripted actions, repetitions with mean/spread             |
| 2   | `02-deterministic-checks.md`              | Sentence count, no lists/menus, language, secret-not-before-turn-N; fixed-transcript tests  |
| 3   | `03-rubric-judge-and-gm-assertions.md`    | 1–5 rubric scores; GM assertions on routing, unlock, dialogue mode, director-note adherence |
| 4   | `04-simulated-visitor-and-robustness.md`  | Simulated-visitor free runs; robustness probes; 30-turn and avatar-switch coherence scripts |
| 5   | `05-ava-baseline-calibration-and-gate.md` | AVA suite for all seven rows, judge calibration on 10 human-rated sessions, regression gate |
| 6   | `06-prompt-tuning-and-doc-sync.md`        | One-change-at-a-time tuning with before/after reports; process rule; full doc sync          |

## Dependencies And Suggested Order

Run in order: `00 -> 01 -> 02 -> 03 -> 04 -> 05 -> 06`.

- `01` needs the typed GM payload and the cleaned-up tool contracts from `00`.
- `02` and `03` plug assertion evaluators into the v2 runner from `01`; `02` has no LLM dependency
  and can be developed in parallel with `03` once `01` lands.
- `04` reuses the runner, checks, and rubric judge.
- `05` needs every assertion family to build the AVA suite and the calibration set.
- `06` needs the baseline and gate from `05`.

## Definition Of Done For The Full EPIC

- [ ] Definition v2 (multi-turn scripts, per-turn assertions, scripted actions) is the only format;
      existing definitions are converted.
- [ ] Deterministic checks (sentence count, no list/menu formatting, language, secret not before
      turn N) are unit-tested against fixed transcripts.
- [ ] Rubric scores (in character, pacing, guidance when stalled) are reported 1–5 with rationale.
- [ ] GM assertions read recorded events: routing, unlock, dialogue mode, director-note adherence.
- [ ] Long-session (30 turns), avatar-switch coherence, robustness probes, and simulated-visitor
      runs exist.
- [ ] Runs repeat N times and report mean and spread; cost is reported for every run and aggregate.
- [ ] The judge is calibrated against ten human-rated sessions, with agreement recorded.
- [ ] The AVA suite covers facts, persona, pacing, guidance, GM decisions, coherence, and
      robustness, with a recorded baseline.
- [ ] A regression threshold flags a drop against the baseline.
- [ ] Every Avatar/GM prompt change in this EPIC ships with a before/after report, and the rule is
      written into `docs/TEST_STRATEGY.md`.
- [ ] `docs/PROJECT_STATUS.md`, `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`,
      `docs/GAME_MASTER_CONTRACT.md`, `docs/API_CONTRACT.md` (typed event payload),
      `tools/conversation-evaluation/README.md`, and `docs/EPICS.md` are synchronized.
