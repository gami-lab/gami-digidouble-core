# Build the Comment Inventory and Write the Policy

# Context

EPIC 11.2 cleans up the codebase before its first release. Agents have left many comments that
restate code or narrate changes, and some comments, TODOs, and suppressions mark hacks. The later
prompts need one agreed policy and a complete list of items with a decision for each, so cleanup is
consistent and nothing gets missed.

# Scope

In scope:

- Add the comment policy from this EPIC's `README.md` to `AGENTS.md` (short section, a few bullets).
- Scan every comment in `apps/`, `packages/`, `tools/`, `scripts/`, and root config files
  (`*.ts`, `*.vue`, `*.mjs`, `*.js`, SQL, Dockerfiles, YAML). Include tests.
- Write the inventory to `docs/implementation-prompts/epic-11-2-comment-audit-and-hack-removal/COMMENT_INVENTORY.md`
  with these sections:
  - **H — hacks**: legacy/compatibility fallbacks, `TODO`/`FIXME`, workarounds, "for now",
    "temporary", magic retries, swallowed errors with an excuse comment. One ID per hack (H1, H2…),
    with file, what the hack does, and the planned fix.
  - **S — suppressions**: every `eslint-disable*` and every `as unknown as`, `as any`, and non-null
    assertion outside tests, grouped by rule and file, with the decision (refactor / keep + reason).
  - **C — comment counts per area** with the dominant noise patterns found, to steer prompts `04`
    and `05`. Do not list every comment.
- Re-measure the baseline counts in `README.md`.

Out of scope: changing production code. This prompt only documents and decides.

# Relevant Docs

- `AGENTS.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md`

# Implementation Guidance

- Start with greps: `TODO|FIXME|XXX|HACK|workaround|legacy|backward|compat|for now|temporar`,
  `eslint-disable`, `as unknown as`, `as any`, `!\.` / `!)`, `catch {` / empty catch blocks with a
  comment. Then read comments file by file: many hacks don't use a keyword (e.g. "default to [] if
  the row predates…").
- For each H item, find the code path, its tests, and its callers. Decide the real fix: delete the
  fallback, implement the missing piece, or move the follow-up to `docs/EPICS.md`.
- Known starting points: `TODO(EPIC-4.2)` in `start-session.use-case.ts` and
  `get-history.use-case.ts`; `TODO(epic-4-5)` in `stream-runtime-events.stack-e2e.test.ts`; legacy
  fallbacks covered by tests in `get-available-avatars`, `admin-memory`, `admin-runtime-actions`,
  and the conversation working-memory repositories; `'legacy'` provider handling in
  `tools/conversation-evaluation/src/runtime-usage.ts`; legacy fields in
  `tools/conversation-evaluation/src/contracts.ts`.
- For S items, `complexity` and `max-lines-per-function` disables are the bulk. Mark each as
  "split" (refactor in prompt `03`) or "keep" only when splitting would make the code worse (e.g. a
  flat exhaustive `switch` over a closed union, a declarative table). Each "keep" needs a one-line
  reason.
- If an H item touches Avatar, Scenario, Session, Conversation, Message, GM state, or admin DTOs,
  note in the inventory whether the type is defined once or duplicated (shared DTO vs local copies,
  optionality drift). Prompt `02` must fix duplication first if removing the hack would otherwise
  mean editing several identical shapes.

# Constraints

- No production code changes in this prompt (only `AGENTS.md`, the inventory, and the README
  baseline).
- Keep the inventory focused on decisions; don't paste code.
- KISS: one inventory file, no new tooling yet.

# Deliverables

- `AGENTS.md` comment policy section.
- `COMMENT_INVENTORY.md` with H, S, and C sections and a decision per H and S item.
- Updated baseline counts in this EPIC's `README.md`.

# Mandatory Pre-Implementation Check

1. Identify which entities and contracts the H items touch.
2. Search for duplicated type definitions for those entities.
3. Identify the canonical owner of each touched contract.
4. Record where shared types should be reused when the hack is removed.
5. If a contract has no canonical owner, flag it as the first step of prompt `02`.

# Mandatory Final Step — Documentation Update

Review and update `docs/PROJECT_STATUS.md` (note that EPIC 11.2 is in progress) and `docs/EPICS.md`
if the inventory changes the EPIC scope. If no other source-of-truth doc changes, verify and state
that they are still accurate. Commit as `docs: inventory comments and hacks (epic 11.2)`.

# Acceptance Criteria

- [ ] `AGENTS.md` contains the comment policy.
- [ ] Every `TODO`/`FIXME`/legacy/workaround marker in the repo has an H entry with a planned fix.
- [ ] Every `eslint-disable` and every production type escape has an S entry with a decision.
- [ ] Per-area comment counts and noise patterns are recorded.
- [ ] No production code changed.
