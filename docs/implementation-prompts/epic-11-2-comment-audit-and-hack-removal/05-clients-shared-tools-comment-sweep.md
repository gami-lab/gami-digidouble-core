# Sweep Comments in Clients, Shared, and Tools

# Context

Outside Core, comments are spread across `packages/shared` (~170 lines), `apps/web` (~75),
`apps/console` (~65), `apps/admin` (~45), `tools/conversation-evaluation` (~40), plus root config,
Dockerfiles, compose files, CI workflows, and `scripts/`. `packages/shared` matters most: its JSDoc
is the public contract documentation clients read.

# Scope

In scope: every comment in `packages/shared`, `apps/admin`, `apps/console`, `apps/web`, `tools/`,
`scripts/`, `eslint.config.mjs` and other root config, `Dockerfile*`, `docker-compose*.yml`, and
`.github/workflows`.

Out of scope: `.github/prompts` and `docs/` (prose, not code); behavior changes. Newly found hacks
go into the inventory and are fixed in a separate commit, as in prompt `02`.

# Relevant Docs

- `AGENTS.md` (comment policy)
- `COMMENT_INVENTORY.md` (this EPIC, C section)
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- `packages/shared`: keep JSDoc that states contract meaning (units, nullability meaning, ordering,
  limits) and make sure it agrees with `docs/API_CONTRACT.md`. Delete JSDoc that repeats the field
  name. If JSDoc and the contract doc disagree, fix whichever is wrong.
- Browser apps: keep comments about browser constraints (autoplay, Web Audio, AbortSignal, SSE
  reconnection). Delete narration of component structure and template banners.
- Evaluation tool: keep comments about judge/report semantics; delete the rest.
- Config and infra: keep comments that explain a non-default choice (why a port, flag, or
  threshold). Delete ones that repeat the key name, such as the per-rule comments in
  `eslint.config.mjs` that restate the rule.
- Rename instead of comment when a name is unclear (local symbols only).
- One commit per package or app.

# Constraints

- No behavior changes; no public DTO renames.
- Do not reformat unrelated code.
- Keep diffs to comments and local naming.

# Deliverables

- Policy-compliant comments across shared, clients, tools, scripts, and config.
- `packages/shared` JSDoc consistent with `docs/API_CONTRACT.md`.
- C section of the inventory updated with before/after counts.

# Mandatory Pre-Implementation Check

1. Identify shared DTOs whose JSDoc you touch.
2. Search for local copies of those DTOs in admin/console/web that carry their own comments.
3. Confirm `packages/shared` is the canonical owner and keep contract documentation there only.
4. Reuse the shared type instead of documenting a local copy; record any remaining copy as a
   follow-up.
5. Do not create new shared types in this prompt.

# Mandatory Final Step — Documentation Update

Review and update `docs/PROJECT_STATUS.md`, the inventory, and `docs/API_CONTRACT.md` if JSDoc
review found a contract mismatch. If no doc changes are needed, verify and state that they are
accurate. Run lint, typecheck, and tests for each touched package. Commit per package as
`refactor(<package>): remove noise comments (epic 11.2)`.

# Acceptance Criteria

- [ ] Every remaining comment outside Core explains a non-obvious "why", an external constraint, or
      a public contract.
- [ ] `packages/shared` JSDoc and `docs/API_CONTRACT.md` agree.
- [ ] No change-narration, epic-reference, or commented-out code remains.
- [ ] Lint, typecheck, and tests pass for every touched package.
