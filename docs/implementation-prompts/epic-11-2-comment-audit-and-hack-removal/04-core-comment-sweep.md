# Sweep Comments in Core

# Context

`apps/core` holds most of the comments (about 1,050 lines: application ~310, domain ~220,
infrastructure ~205, api ~150, tests ~230). With hacks and suppressions gone, what is left is mostly
noise: comments that restate code, narrate changes, reference epics, or repeat type names in JSDoc.
This prompt applies the comment policy to every remaining comment in Core.

# Scope

In scope: every comment in `apps/core/src` and `apps/core/tests`, including SQL schema comments,
seed data, test utilities, and tools under `apps/core/src/tools`.

Out of scope: behavior changes. If a comment reveals a hack missed by the inventory, add it as a new
H item and fix it the way prompt `02` describes, in a separate commit.

# Relevant Docs

- `AGENTS.md` (comment policy)
- `COMMENT_INVENTORY.md` (this EPIC, C section)
- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Go layer by layer (`domain → application → infrastructure → api → tests`), one commit per layer,
  so each diff is easy to review.
- For each comment, ask: would a competent reader miss something important without it? If not,
  delete it.
- Keep: provider quirks, ordering requirements (e.g. why the GM runs after the reply), security and
  redaction reasons, non-obvious SQL/pgvector choices, and JSDoc on exported ports that documents
  semantics the types can't express (units, ownership, failure meaning).
- Delete: JSDoc that repeats the function or parameter name, section banners, "Step 1/2/3"
  narration of obvious code, epic or prompt references, commented-out code, eslint-config-style
  comments that repeat the rule name.
- When a comment is needed because a name is unclear, rename the symbol instead and drop the
  comment.
- Rewrite stale comments so they match the current code.
- In tests, test names carry the intent; delete comments that repeat them.

# Constraints

- No behavior changes in this prompt (renames are fine if purely local).
- Do not reformat unrelated code.
- Keep the diff to comment and naming changes.

# Deliverables

- Core comments reduced to policy-compliant "why" comments.
- Any newly found hacks added to the inventory and fixed.
- C section of the inventory updated with before/after counts for Core.

# Mandatory Pre-Implementation Check

1. Identify any entities/contracts touched by renames.
2. Search for duplicated type definitions before renaming a type or field.
3. Identify the canonical owner; rename at the owner, not a copy.
4. Reuse existing shared names where possible.
5. Do not rename public DTO fields in this prompt; record such needs as follow-ups instead.

# Mandatory Final Step — Documentation Update

Review and update `docs/PROJECT_STATUS.md` and the inventory. If a deleted comment held information
that belongs in a source-of-truth doc (e.g. a GM ordering rule), move it there before deleting it.
If no doc changes are needed, verify and state that they are accurate. Run `pnpm --filter @gami/core lint`,
`typecheck`, and `test`. Commit per layer as `refactor(core): remove noise comments in <layer> (epic 11.2)`.

# Acceptance Criteria

- [ ] Every remaining Core comment explains a non-obvious "why", an external constraint, or a
      public contract.
- [ ] No change-narration, epic-reference, or commented-out code remains in Core.
- [ ] Information worth keeping was moved to docs, not lost.
- [ ] Core lint, typecheck, and tests pass.
