# Title

Verify Media End To End On AVA, Harden, And Sync Docs

# Context

The EPIC is done only when the AVA intro video plays at session start and a GM cue shows an image
during a live conversation, with timing recorded. This slice verifies that on the real stack,
closes gaps, and synchronizes docs.

# Scope

Implement now:

- end-to-end verification on the local stack (and deployed, if available) with the AVA seed:
  intro video plays and can be skipped; an unlock or switch trigger plays its media once; a GM cue
  shows an image during a live conversation; voice loop resumes afterwards
- record the evidence: event ids, cue → playback latency from `event_log`, browser used; store a
  short note next to this pack (`verification-<date>.md`)
- `apps/console`: show `media.cue_emitted` and `media.playback_*` in the session timeline using the
  existing timeline mapping (bounded fields only)
- evaluation impact: confirm `tools/conversation-evaluation` still parses GM output with the new
  optional field
- failure drills: missing file on disk, URL asset unreachable, oversized upload, inactive scenario,
  GM cue to a deleted asset — each degrades without affecting the turn
- cleanup: no remaining references to `mediaUri` or the `media` knowledge format; no TODOs; comment
  policy
- full checks: format, lint, typecheck, test, build, stack-e2e, bundle secret scan

Out of scope:

- new features; anything found that is not a 12.3 defect goes to `docs/EPICS.md`

# Relevant Docs

- `docs/PROJECT_STATUS.md`, `docs/EPICS.md`
- `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/GAME_MASTER_CONTRACT.md`
- `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`

# Implementation Guidance

- Use the console session timeline to read event ordering rather than adding new diagnostics.
- If a GM cue does not happen naturally in a live run, use a scripted conversation that reaches the
  described moment; do not force the cue through a test-only path in production code.

# Constraints

- No personal data in verification notes.
- Diagnostics stay bounded.

# Deliverables

- verification note with evidence
- console timeline support for media events
- fixes from failure drills
- synchronized docs; 12.3 marked done

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated media/event type definitions left in web, admin, console, tools.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (12.3 shipped)
- `docs/EPICS.md` (12.3 marked done with a shipped summary; follow-ups)
- `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/GAME_MASTER_CONTRACT.md`
- `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] AVA intro video plays at session start.
- [ ] A GM cue shows an image during a live conversation; latency recorded.
- [ ] Failure drills degrade safely without affecting turns.
- [ ] Console timeline shows media events.
- [ ] All checks pass; docs synchronized; 12.3 marked done.
