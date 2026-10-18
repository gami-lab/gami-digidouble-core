# Title

Validate With Hallway Tests, Harden, And Sync Docs

# Context

The EPIC's definition of done is a human outcome: a first-time visitor reaches the first exchange
in under 30 seconds without explanation. Unit and behavior tests cannot prove that. This slice
closes gaps found in real use, checks mobile and accessibility, and synchronizes docs.

# Scope

Implement now:

- an instrumented timing in the player: time from landing render to first sent message, logged
  only to the browser console or an existing bounded client metric path (no new telemetry backend)
- five hallway tests on the deployed AVA scenario (phone and desktop), with notes per test: time to
  first exchange, where the visitor hesitated, wording confusion, voice issues
- fix the issues the notes reveal that are in 12.2 scope; list the rest as follow-ups in
  `docs/EPICS.md`
- mobile layout check (375px wide), keyboard-only path through the whole flow, screen-reader labels
  on cards, mic control, moments, and hint
- remove dead code left from the old one-page player (`discovery` sections, identity summary,
  unused i18n keys)
- confirm no debug views or technical terms remain in `apps/web`; anything operators still need
  lives in `apps/console`
- full checks: format, lint, typecheck, test, build; web behavior suite green

Out of scope:

- new features beyond fixes from hallway notes

# Relevant Docs

- `docs/PROJECT_STATUS.md`, `docs/EPICS.md`
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`
- `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`

# Implementation Guidance

- Store hallway notes as a short markdown file next to this prompt pack
  (`hallway-tests-<date>.md`): five rows, no personal data about participants.
- `rg` the web `i18n` files for keys no component uses and delete them.
- Verify the presentation contract docs match what shipped (field names, limits).

# Constraints

- No personal data in notes or logs.
- Comment policy applies to all touched files.

# Deliverables

- time-to-first-exchange measurement
- five recorded hallway tests and the fixes they prompted
- accessibility and mobile fixes
- removed dead code
- synchronized docs; 12.2 marked done

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions left in `apps/web` and `apps/admin`.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (12.2 shipped)
- `docs/EPICS.md` (12.2 marked done with a shipped summary; follow-ups from hallway notes)
- `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md` (presentation contract)
- `docs/ARCHITECTURE.md` (web player flow)
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Five hallway tests recorded; at least four of five reach the first exchange in under 30 s
      without explanation (record actual times).
- [ ] Whole flow works keyboard-only and at 375px width.
- [ ] No dead code or technical wording left in `apps/web`.
- [ ] All checks pass.
- [ ] All impacted docs synchronized and 12.2 marked done.
