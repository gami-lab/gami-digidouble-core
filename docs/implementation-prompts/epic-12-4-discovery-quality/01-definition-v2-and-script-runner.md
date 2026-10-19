# Title

Add Definition v2 With Multi-Turn Scripts And Repeated Runs

# Context

Definition v1 is a flat question list judged one answer at a time. Discovery quality depends on how
a conversation unfolds: what the character reveals when, how it reacts to silence, whether it
stays coherent after an avatar switch. The runner needs scripts with per-turn assertions and
repetition as a built-in, so later prompts only add assertion evaluators.

# Scope

Implement now:

- definition v2 (`version: 2`) in `src/definition.ts`:
  - top level: name, scenario, initial avatar, model(s), judge model, avatar options (as v1),
    `repetitions` (default 5)
  - `scripts[]`: id, title, optional per-script initial avatar, ordered `turns[]`
  - turn: either `{ user: string }` or a scripted action (`{ action: 'switch_avatar', avatarName }`,
    `{ action: 'silence' }` for "visitor says nothing / says je ne sais pas" stalls, implemented as a
    configured stall utterance), plus `assertions[]`
  - assertion: `{ type, ... }` with a discriminated union; v1 criteria become
    `{ type: 'facts', requiredFacts, acceptedAlternatives, forbiddenClaims, expectedResponse }`
  - script-level assertions evaluated over the whole transcript (for pacing/coherence later)
- each script runs in a fresh session and user; turns run in one conversation, switching via the
  existing switch-avatar route; keep the GM/memory settle wait, made configurable
- repetitions: every script runs N times; per assertion and per family the report stores each
  result plus mean, min, max, standard deviation
- report v2 in `src/contracts.ts`/`report.ts`: script → repetition → turn → assertion results,
  with family tags (`facts`, `deterministic`, `rubric`, `gm`) and per-run cost
- convert every file in `definitions/` to v2 and delete the v1 parser path
- viewer: show scripts, turns, assertion results, and spread; keep human review working per
  assertion result

Out of scope:

- new assertion types beyond `facts` (prompts `02`–`04`)

# Relevant Docs

- `tools/conversation-evaluation/README.md`
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`
- `docs/API_CONTRACT.md` (switch-avatar, player tokens)

# Implementation Guidance

- Reuse `sequential-runner.ts` and `core-api-client.ts`; extend rather than fork. Keep the
  atomic-write-after-every-turn behavior so interrupted runs stay readable.
- Assertion evaluation goes through a registry keyed by `type`; each evaluator receives the turn,
  the transcript so far, and recorded events for the turn's correlation id.
- Model comparison and `--append` keep working: one comparison report holds v2 run reports.
- Tests: definition validation (unknown assertion type, duplicate script ids, invalid action),
  runner with a fake Core client (switch, silence, repetitions), statistics, report round trip,
  converted definitions validate.

# Constraints

- No provider calls in unit tests.
- Never print or store the service key or player tokens.
- Keep `@gami/shared` as the owner of Core DTOs.

# Deliverables

- v2 definition parser and types; v1 removed; definitions converted
- script runner with actions and repetitions; v2 report with statistics
- viewer support
- unit and integration tests

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (definition, report, comparison report, viewer data).
2. Search for duplicated type definitions inside the tool and against `@gami/shared`.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `tools/conversation-evaluation/README.md` (v2 format, repetitions, report shape)
- `docs/TEST_STRATEGY.md` (evaluation tool role)

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] v2 scripts with per-turn assertions, switch and silence actions run end to end.
- [ ] Each script runs N times; reports show mean and spread.
- [ ] All existing definitions are v2; the v1 path is gone.
- [ ] Viewer and human review work on v2 reports.
- [ ] Documentation reviewed and updated.
