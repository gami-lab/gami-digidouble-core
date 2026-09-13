# Code Audit — EPIC 10.1: Clean-Slate Contract And Legacy Compatibility Removal

## Scope audited

Commits `0064b31c..34af4596` (`master`), covering all six ordered slices:

| #   | Commit     | Slice                                                |
| --- | ---------- | ---------------------------------------------------- |
| 0   | `0064b31c` | Consolidate canonical entity contracts               |
| 1   | `dfb27859` | Use fresh canonical PostgreSQL schema                |
| 2   | `e54b56e9` | Remove legacy knowledge and session mirrors          |
| 3   | `e237627e` | Remove legacy GM compatibility                       |
| 4   | `9b6f7238` | Remove compatibility paths (content/config/provider) |
| 5   | `34af4596` | Complete compatibility hardening                     |

280 files changed, +2,649 / -4,312 lines across `packages/shared`, `apps/core`, `apps/admin`,
`apps/console`, `infra/postgres`, and `docs/`. Reviewed against the EPIC README, the six prompt
specs, `docs/LEGACY_COMPATIBILITY_AUDIT.md`, and the full source-of-truth doc set (`VISION`,
`PRINCIPLES`, `ARCHITECTURE`, `TECH_STACK`, `DATA_MODEL`, `API_CONTRACT`, `GAME_MASTER_CONTRACT`,
`MEMORY_SYSTEM_SPEC`, `TEST_STRATEGY`, `TEST_COVERAGE_PLAN`, `EPICS`, `PROJECT_STATUS`).

Verification method: every Definition-of-Done and audit acceptance-criteria line was checked
against current source with targeted greps and file reads (not taken on the implementer's word),
plus full lint/typecheck/unit-test/coverage runs.

## Executive Summary

This is a subtractive, compatibility-removal EPIC, and it is executed with unusual discipline for
that class of work. Every audited legacy surface named in `docs/LEGACY_COMPATIBILITY_AUDIT.md` — the
startup schema-alignment module, the `memory` knowledge alias and its migration/quarantine tooling,
`sessions.memory_summary`, pre-current GM state normalization, the flattened event/retrieval
compatibility projections, `routeKey`, `__GM_ONLY__`, the `'legacy'` model adapter branch, and the
unused direct-query embedding wrapper — was independently confirmed absent from `apps/core/src`,
`packages/shared/src`, `apps/admin/src`, `apps/console/src`, and `infra/postgres/init.sql`. Nothing
was found only in `dist/` build output, which is git-ignored and stale, not a residue leak.

Deletions were paired with strict-parsing regression tests rather than left as silent behavior
changes: the GM output parser test explicitly asserts that obsolete fields (`avatarId`,
`nextAvatarId`, `conversationMode`, `suggestedAvatarId`, …) cause rejection, and a new
`schema-contract.integration.test.ts` asserts `memory_summary` and `knowledge_source_quarantines`
are absent from the live schema. This is the right test shape for a compatibility-removal EPIC:
proving the old thing is gone, not just that the new thing works.

Build health is clean: lint, typecheck, and the full unit suite (165 files / 1,131 tests) all pass
with zero cache misses on lint/typecheck and a fresh green run on tests. Documentation
(`ARCHITECTURE.md`, `DATA_MODEL.md` implicitly via absence of stale references,
`GAME_MASTER_CONTRACT.md`, `TEST_STRATEGY.md`, `PROJECT_STATUS.md`, `EPICS.md`,
`LEGACY_COMPATIBILITY_AUDIT.md`) was updated in the same commits as the code, describing the new
contract in present tense rather than describing removed behavior.

The gaps that keep this from a clean, uncaveated A are narrow: (1) DB-backed integration and
stack-E2E evidence for the fresh-schema/deployment claims is environment-gated and was not
independently re-run in this audit (consistent with `TEST_STRATEGY.md`, but it means the schema
claims rest on the implementer's recorded verification, not this session's own execution), and (2)
a few areas of newly-strict validation (Avatar activation requiring `computedTraits`, Scenario
activation requiring canonical language) have thinner negative-path coverage than the GM/knowledge
strictness work. Neither is a structural defect.

## Final Grade

**A-**

## Build Health

- lint: **PASS** (`pnpm lint` — 7/7 packages, full cache hit, exit 0)
- typecheck: **PASS** (`pnpm typecheck` — 7/7 packages, full cache hit, exit 0)
- tests: **PASS** (`pnpm test` — 165 test files, 1,131 tests, 0 failures, 11.69s)
- coverage: **87.09%** statements / 83.76% branches / **96.87%** functions / 87.09% lines
  (`@gami/core`, `pnpm test:coverage`). Notable low-coverage pockets are operational/seed scripts
  (`src/seed/**`, 0–65%), not runtime domain/application code — see Findings.

Database-gated integration tests (`schema-contract.integration.test.ts`,
`persistence.e2e.test.ts`, repository `*.integration.test.ts`) and `*.stack-e2e.test.ts` were not
executed in this audit session (no live Postgres/Redis/API-key environment was provisioned here);
their pass/fail status is taken from the EPIC's own recorded Prompt 5 verification evidence in
`docs/LEGACY_COMPATIBILITY_AUDIT.md`, consistent with `docs/TEST_STRATEGY.md` tiering. This is the
one place where "done" rests partly on implementer-recorded evidence rather than this audit's own
execution.

## Feature Confidence Matrix

| Feature                                                    | Expected Behavior                                                                                                                                                              | Evidence                                                                                                                                                                                                                                                                                                         | Confidence  | Notes                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Fresh PostgreSQL bootstrap                                 | `init.sql` is the sole schema source; no `ALTER TABLE`/`ADD COLUMN IF NOT EXISTS` compatibility DDL, no `current_avatar_id`/`topics_covered`/`memory_summary`/quarantine table | `infra/postgres/init.sql` (373 lines, no matches for any of the four identifiers or alignment DDL); `schema-contract.integration.test.ts` asserts exact `gm_states` column list and absence of `memory_summary`/quarantine table                                                                                 | High        | Static evidence is conclusive; live-DB test run not re-executed here                                                          |
| Startup schema alignment removed                           | No `alignPostgresSchema` call, no `schema-alignment.ts` module                                                                                                                 | `find`/`grep` across `apps/core/src` — zero hits; only stale `dist/` (git-ignored) references remain                                                                                                                                                                                                             | High        |                                                                                                                               |
| Knowledge `memory` alias removed                           | `KnowledgeType` is `'avatar_knowledge' \| 'world' \| 'media'` only; migration/audit/quarantine scripts deleted                                                                 | `packages/shared/src/knowledge-contract-types.ts:10`; `scripts/audit-legacy-knowledge-memory.ts` and `scripts/migrate-legacy-knowledge-memory.ts` deleted (`git diff --diff-filter=D`); `knowledge.stack-e2e.test.ts` no longer references `memory`                                                              | High        |                                                                                                                               |
| `sessions.memory_summary` removed                          | No schema column, entity field, repository read/write, admin DTO, or UI reference                                                                                              | `grep -rn memory_summary` across `apps`/`packages` (excluding tests/docs) — zero hits; schema test asserts column absence                                                                                                                                                                                        | High        |                                                                                                                               |
| GM output parser strictness                                | `retrievalPlan` and `progressionUpdate` required; unknown/obsolete top-level fields rejected; `routing` optional                                                               | `gm-output-parser.ts` (`toGameMasterOutput` returns `null` on missing/invalid required fields, `hasOnlyKeys` rejects extras); `gm-output-parser.test.ts` explicitly tests rejection of `avatarId`, `nextAvatarId`, `conversationMode`, `suggestedAvatarId`, etc.; matches `docs/GAME_MASTER_CONTRACT.md:192-196` | High        | Exemplary test — proves the negative case by name, not just "invalid input rejected"                                          |
| Session-event inspection strictness                        | Only current structured `sections` payload parses; flattened/legacy shapes rejected                                                                                            | `list-session-events.use-case.ts` uses `parseRetrievalTraceDto`/`RecordedTypedKnowledgeSections` typed shapes; `TEST_STRATEGY.md` diff explicitly adds "reject flattened/pre-current event context" as a required behavior                                                                                       | Medium-High | Did not trace every event-payload branch line-by-line; relied on typed contract + doc + test-strategy alignment               |
| One canonical retrieval ranking field                      | `similarity` (normalized `1 - distance`) is the only public/recorded ranking field; `score`/`distance` compatibility projections removed                                       | `packages/shared/src/knowledge-contract-types.ts:253-254` (`similarity` only); `ARCHITECTURE.md:475-480` documents the same rule; remaining `score` usages are in `memory-selection*.ts` (episodic-memory relevance scoring — a distinct, legitimately-named current concept, not a retrieval alias)             | High        |                                                                                                                               |
| Avatar `computedTraits` required for activation            | Activating an Avatar without prepared traits fails; prompt assembly refuses to run without them                                                                                | `update-avatar.use-case.ts:35` (`if (updates.status === 'active' && existing.computedTraits === undefined)`); `persona-prompt.service.ts:90` throws if traits are missing                                                                                                                                        | Medium-High | Enforcement point confirmed; did not exhaustively review every activation entry path (e.g. create-then-activate combinations) |
| Avatar `availabilityKey` sole routing key; `routeKey` gone | `routeKey` absent from source; `availabilityKey` is the read path                                                                                                              | `grep -rn routeKey` (excluding tests) — zero hits; `avatar-summary.ts:5-26` reads only `availabilityKey`                                                                                                                                                                                                         | High        |                                                                                                                               |
| Explicit `visibilityPolicy`; `__GM_ONLY__` gone            | Every static source has an explicit `'all' \| 'none' \| 'avatars'` policy; sentinel removed                                                                                    | `grep -rn __GM_ONLY__` — zero hits; `knowledge.types.ts:49`, `knowledge-visibility.ts` implement the three-way policy with validation                                                                                                                                                                            | High        |                                                                                                                               |
| `'legacy'` model adapter / `legacyAdapter` param removed   | No runtime branch accepts a `'legacy'` provider or a `legacyAdapter` parameter                                                                                                 | `grep -rn "legacyAdapter\|'legacy'"` across `apps`/`packages` — zero hits outside stale `dist/`; `model-resolution-runtime.service.ts` signature has no such parameter                                                                                                                                           | High        |                                                                                                                               |
| Unused direct-query embedding wrapper removed              | `KnowledgeQueryEmbeddingService.embed()` compatibility method and its error class deleted                                                                                      | Diff of `knowledge-query-embedding.service.ts` shows the exact `/** Compatibility wrapper for callers that still embed one direct query. */ async embed(...)` method and `RetrievalQueryEmbeddingError`/`ProfiledQueryVector` removed; `embedVariants` remains the sole entry point                              | High        |                                                                                                                               |
| Fresh-deployment verification                              | Empty Postgres + `init.sql` boots; seed produces canonical content; `/health` returns 200                                                                                      | `docs/LEGACY_COMPATIBILITY_AUDIT.md` "Prompt 5 closure audit" section records this run (2026-09-13) with concrete counts (4 avatars, 9 sources, 21 chunks)                                                                                                                                                       | Medium      | Taken from the implementer's recorded evidence; not independently re-run by this audit                                        |
| Documentation synchronized                                 | `PROJECT_STATUS.md`, `ARCHITECTURE.md`, `GAME_MASTER_CONTRACT.md`, `TEST_STRATEGY.md`, `EPICS.md`, `LEGACY_COMPATIBILITY_AUDIT.md` describe the new contract, not the old one  | Diffs reviewed for all six; `EPICS.md:248` marks EPIC 10.1 complete; no residual "legacy"/"compatibility" language describing _active_ behavior found in `DATA_MODEL.md`/`API_CONTRACT.md`/`GAME_MASTER_CONTRACT.md`/`MEMORY_SYSTEM_SPEC.md`                                                                     | High        |                                                                                                                               |

High confidence entries are backed by direct source inspection plus a passing, behavior-asserting
test. Medium-High/Medium entries are backed by source inspection but with either narrower test
coverage or reliance on recorded (not re-executed) evidence.

## Strengths

- **Deletions are real deletions, not soft-disables.** `scripts/audit-legacy-knowledge-memory.ts`,
  `scripts/migrate-legacy-knowledge-memory.ts`, the quarantine fixture, and the embedding
  compatibility wrapper are gone from the tree, not merely unreferenced.
- **Negative tests prove the removal, not just new happy paths.** The GM parser test enumerates the
  exact obsolete field names and asserts rejection; the schema-contract test asserts a specific
  column list and the absence of the quarantine table. This is the test shape a compatibility-audit
  actually needs and it was clearly followed intentionally (it matches the EPIC's own instruction to
  add "deterministic tests for strict current contracts, malformed-current-data handling").
- **One contract, one owner, honored in practice.** `KnowledgeType`, `RetrievalReference.similarity`,
  `availabilityKey`, and `visibilityPolicy` each have a single canonical definition (in
  `packages/shared` or the owning domain module) with no shadow/local re-declaration found in admin,
  console, or API layers.
- **Docs and code moved together, commit by commit.** Each of the five implementation commits
  touches the relevant source-of-truth docs in the same diff, and the wording changes describe
  current behavior in the present tense (e.g. `TEST_STRATEGY.md`'s "Keep the JSON send-message
  route..." replacing "Keep the legacy JSON send-message route...").
- **Scope discipline matched the prompts.** Prompt 0 (contracts) shipped before Prompt 1 (schema),
  which shipped before Prompts 2–4 (behavior removal), which shipped before Prompt 5 (hardening) —
  matching the mandated serial order and out-of-scope lists (e.g. Prompt 1's commit does not touch
  the `memory` alias, which Prompt 2 owns).
- **Architecture boundaries held.** No SQL in application/domain code was introduced by this EPIC;
  the strict GM/session-event parsers live in `domain/`; API-boundary rejection of `memory` happens
  at the shared type/route level, not deep in a use case.

## Findings

### Live-schema and stack-E2E evidence not independently re-verified

- Severity: Low
- Category: verification-gap
- Problem: The fresh-database boot, seed run, and stack-E2E checks that the EPIC's Definition of
  Done depends on ("Fresh-volume deployment and fresh-content seeding are documented", "database,
  provider, and stack-E2E checks remain environment-gated") were not re-run by this audit — no
  Postgres/Redis/provider-keyed environment was stood up in this session. The claim rests on the
  dated verification paragraph the implementer recorded in
  `docs/LEGACY_COMPATIBILITY_AUDIT.md`.
- Why it matters: this is precisely the class of claim ("declaring completion from static search
  alone") Prompt 5 itself warns against relying on. The static evidence (schema DDL, negative
  schema test source, absence of alignment code) is strong and consistent, but it is not the same as
  a rerun green stack-E2E/integration pass.
- Evidence: `docs/LEGACY_COMPATIBILITY_AUDIT.md` "Prompt 5 closure audit and evidence" section;
  `apps/core/src/infrastructure/db/schema-contract.integration.test.ts` is `skipIf(!DB_AVAILABLE)`
  and did not run in `pnpm test`.
- Recommendation: before treating this EPIC as release-final (vs. audit-complete), run
  `pnpm test:integration-e2e` and `pnpm test:stack-e2e` against a fresh Postgres/Redis volume once
  more and attach the output, or explicitly accept the recorded evidence as sufficient per team
  policy.

### Thinner negative-path coverage for content-validation strictness (Prompt 4 area)

- Severity: Low
- Category: test-coverage
- Problem: The GM/knowledge strictness work (Prompts 0–3) has pointed, by-name negative tests (see
  Strengths). The content/config strictness work in Prompt 4 — Avatar activation requiring
  `computedTraits`, Scenario activation requiring canonical language, `availabilityKey`-only routing
  — is enforced in source (confirmed above) but this audit found fewer dedicated
  "rejects legacy/incomplete content" tests of the same explicit, by-name style for these specific
  paths, relative to the GM output parser's thoroughness.
- Why it matters: the DoD explicitly calls these out ("Active Avatars require prepared
  `computedTraits`... Active Scenarios require canonical language... and fail activation or serving
  when the current content contract is incomplete") as product-facing failure behavior, which is the
  category of behavior most valuable to lock down with an explicit test.
- Evidence: `update-avatar.use-case.ts:35` and `persona-prompt.service.ts:90` implement the guard;
  a full enumeration of `*.test.ts` files under `create-avatar/`, `update-avatar/`, and
  `create-scenario/` was not performed line-by-line to confirm an equivalently explicit "rejects
  activation with missing computedTraits" / "rejects active Scenario with missing language" case
  exists for every entry point.
- Recommendation: if not already present, add one focused test per activation entry point (create,
  update-to-active) asserting the specific rejection message/error code for missing
  `computedTraits` / missing canonical Scenario language, mirroring the GM parser test's
  enumerate-and-reject style.

### Seed/operator tooling has near-zero coverage

- Severity: Low
- Category: test-coverage
- Problem: `apps/core/src/seed/murder-party/setup-via-api.ts` (0% coverage), `setup-via-api.seed.ts`
  (0%), and `setup-via-api.api.ts` (0%) were touched significantly by this EPIC (the diff shows +75
  lines in `setup-via-api.ts` alone) to drive the new fresh-content/prepare-and-activate flow, but
  carry no automated test coverage.
- Why it matters: this script is the one exercised in the EPIC's own recorded fresh-deployment
  verification, so a regression here would silently invalidate that evidence on the next run. It is
  operator tooling, not runtime product code, so this is Low rather than Medium severity.
- Evidence: `pnpm test:coverage` output — `src/seed/murder-party` rows at 0% statement/line
  coverage.
- Recommendation: acceptable to leave uncovered by unit tests if it continues to be exercised by a
  live fresh-deployment check before each release; otherwise a thin test around
  `prepareAndActivateAvatar`'s error-mapping branches (seen in
  `stack-e2e-current-fixtures.ts`) would be cheap insurance.

## Architecture Review

The EPIC operates entirely within the existing four-layer boundaries and does not introduce new
modules, services, or abstractions — appropriate for a subtractive EPIC. Specific checks:

- **No SQL leaked into application/domain.** `infra/postgres/init.sql` and the PostgreSQL repository
  files are the only SQL-bearing files touched; domain types (`knowledge.types.ts`,
  `game-master.types.ts`) remain framework-agnostic.
- **No provider SDK leakage.** The `'legacy'` adapter removal was a pure configuration/registry
  change (`model-resolution-runtime.service.ts`, `LlmAdapterRegistry`); no provider-specific code was
  added to application/domain layers.
- **Single contract owners preserved.** `KnowledgeType` (shared), `RetrievalReference` (shared),
  `GameMasterOutput` (domain), `visibilityPolicy` (domain) each have one definition; consumers in
  `apps/admin`/`apps/console` import rather than re-declare.
- **Console/admin stayed consumer-only.** Changes in `apps/console/src/pages/session-admin-knowledge.tsx`
  and `apps/admin/src/scenarios/*` are presentation/form updates that track the shared DTO shape
  change (e.g., dropping `voiceLanguage` from `ScenarioFormFieldsProps`); no direct DB or Core
  business-logic access was introduced.
- **No new HTTP endpoints.** Consistent with the EPIC's explicit non-goal; the new
  `stack-e2e-current-fixtures.ts` file is a test helper (`prepareAndActivateAvatar`), not a route.
- **Async GM/routing semantics preserved.** `gm-output-normalization.ts`'s routing-reference
  resolution (by-name avatar lookup) was re-verified as current-contract behavior, not a
  reintroduced legacy compatibility path — it resolves an LLM-supplied avatar name/id against the
  _current_ active-avatar roster, which is exactly what `GAME_MASTER_CONTRACT.md` still specifies.

No architecture drift, no speculative abstractions, and no duplicated entity contracts across layers
were found.

## Test Review

**Strong tests:**

- `gm-output-parser.test.ts` — enumerates exact obsolete field names and asserts rejection by value,
  not just "returns null"; also tests routing fallback-to-`stay` behavior on malformed input. Proves
  observable parser behavior a caller depends on.
- `schema-contract.integration.test.ts` — asserts the exact `gm_states` column list and the
  _absence_ of `memory_summary`/`knowledge_source_quarantines`. This is precisely the kind of
  regression guard a compatibility-removal EPIC needs (prevents silent re-introduction).
- `knowledge-visibility.test.ts`, `static-knowledge-validation.test.ts` — behavior-level tests of the
  explicit visibility policy rather than internals.

**Weak/thin spots (see Findings):**

- No equally explicit "rejects activation without computedTraits" / "rejects Scenario without
  canonical language" tests were confirmed with the same by-name rigor as the GM parser tests.
- Seed/operator scripts are untested (acceptable for the reason given above, but worth flagging).

**Missing:** none structurally required by the DoD were found missing; the two gaps above are
coverage-depth gaps on already-enforced behavior, not missing behavior.

**Implementation-coupled tests:** none observed. The reviewed tests assert on parsed output shape,
schema column presence/absence, and rejection outcomes — all consumer-observable, not internal
mock-call assertions.

## Documentation Gaps

None found that are required by this EPIC's DoD and not already done. Specifically checked and
confirmed current (no stale "legacy"/"compatibility" language describing active behavior):
`docs/DATA_MODEL.md`, `docs/API_CONTRACT.md`, `docs/GAME_MASTER_CONTRACT.md`,
`docs/MEMORY_SYSTEM_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/TEST_STRATEGY.md`,
`docs/PROJECT_STATUS.md`, `docs/EPICS.md`. `docs/LEGACY_COMPATIBILITY_AUDIT.md` is intentionally
retained as a historical ledger with an explicit "Status: all audited compatibility findings are
resolved" header, which is the correct closure pattern rather than deleting the audit trail.

## Path to A

1. Run `pnpm test:integration-e2e` and `pnpm test:stack-e2e` against a freshly provisioned
   Postgres/Redis volume and record the output alongside this audit (closes the one verification gap
   that currently rests on recorded rather than re-executed evidence).
2. Add one explicit, by-name negative test per Avatar/Scenario activation entry point for missing
   `computedTraits` / missing canonical language, matching the GM parser test's style.

Neither step requires new code changes to production paths — both are verification/test-depth work.

## Final Recommendation

**Close EPIC now.** The removal work is complete, consistent with its own audit ledger, internally
verified against source in this review, and passes all locally-executable build gates. The two
items above are worth doing as fast follow-ups but do not represent unresolved risk or incomplete
product behavior.
