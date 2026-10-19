# Title

Add Deterministic Response Checks

# Context

Several quality rules are mechanical and should never depend on an LLM judge: a voice-first
character answers in a few sentences, never in bullet lists or option menus, in the scenario
language, and does not reveal a secret before its time (Max offered three secrets in his first
live reply). Code checks are cheap, stable across repetitions, and make regressions obvious.

# Scope

Implement now, as v2 assertion types evaluated without any LLM:

- `max_sentences` (`{ max }`): sentence count of the cleaned Avatar response, with abbreviations,
  ellipses, and French punctuation handled
- `no_list_or_menu`: rejects markdown/numbered/bulleted lists, "option A / B / C" menus, and
  multiple enumerated choices in one reply
- `language` (`{ expected }`): response language matches (lightweight heuristic, e.g. stopword
  ratio for `fr`/`en`; no new dependency unless the heuristic proves unreliable on fixtures)
- `not_revealed_before` (`{ secretId, turn }`) with script-level `secrets[]`
  (`{ id, markers: string[] }`): fails if any marker appears before the given turn; markers are
  normalized (case, accents, punctuation) phrases, and the check reports which marker matched
- `max_secrets_per_turn` (`{ max }`): counts distinct secrets revealed in one reply
- script-level defaults so every turn of a voice scenario gets `max_sentences` and
  `no_list_or_menu` without repeating them

Out of scope:

- semantic secret detection (that is a rubric/judge concern in prompt `03`; the deterministic check
  is the cheap first line)

# Relevant Docs

- `tools/conversation-evaluation/README.md`
- `docs/TEST_STRATEGY.md`
- `docs/GAME_MASTER_CONTRACT.md` (response constraints context)

# Implementation Guidance

- New module `src/checks/` with one pure function per check and a shared text normalizer.
- Check whether Core already has a sentence splitter (Avatar response cleaner, TTS sentence
  handling) that could be reused; the tool must not import Core internals, so move a shared pure
  helper to `@gami/shared` only if both sides genuinely need it.
- Fixed-transcript tests: a fixture file of real (anonymized) responses including Max's first-reply
  secret dump, French typography, lists disguised as prose, and borderline cases; each check has
  pass and fail cases.

# Constraints

- Pure functions, deterministic, no network.
- No regex soup without tests; every pattern is covered by a fixture.

# Deliverables

- deterministic assertion evaluators registered in the v2 runner
- script-level secrets and default assertions in the definition schema
- fixture-based unit tests

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (definition assertion union, report results).
2. Search for existing sentence/list/language helpers in Core and shared.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `tools/conversation-evaluation/README.md` (check types, secrets)
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] All five checks run without an LLM and are unit-tested on fixed transcripts.
- [ ] The Max first-reply fixture fails `not_revealed_before` / `max_secrets_per_turn`.
- [ ] Voice scenarios can set default per-turn checks once per script.
- [ ] Documentation reviewed and updated.
