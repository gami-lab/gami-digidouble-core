# Prove Retrieval Quality And Complete Documentation

## Context

The preceding slices establish vector queries, filtered pgvector search, runtime integration, and
safe diagnostics. EPIC 5.1d is complete only when tests prove semantic behavior, SQL eligibility
and index compatibility, failure isolation, consistent composition, and documentation accuracy
across all production consumers.

## Scope

Implement now:

- build a requirements-to-tests matrix for the full EPIC and close only uncovered cases;
- add deterministic semantic fixtures where paraphrases share vector proximity and unrelated text
  ranks below or is excluded according to the established selection contract;
- verify query batching/order, multi-variant balancing, duplicate removal, per-type bounds, and
  active profile consistency end to end;
- verify PostgreSQL cosine order, scenario/type/status/static scope, Avatar/GM visibility,
  dimension/profile isolation, candidate limits, and index-compatible query form;
- verify provider and database failures preserve Avatar responses, mark required evidence
  insufficient, keep GM async, and never activate lexical fallback;
- audit production composition and every retrieval call site for alternate algorithms or test
  adapters accidentally used as defaults;
- verify safe, bounded diagnostics and Context Engine inclusion/trimming traces;
- run the full relevant quality gates and synchronize all source-of-truth documentation.

Out of scope:

- judging prose quality with an LLM;
- live-provider calls as a mandatory CI requirement;
- threshold tuning without measured fixtures;
- hybrid search, reranking, memory redesign, or unrelated cleanup.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Use a deterministic fake embedding adapter whose fixture vectors encode known semantic groups;
  do not test semantic retrieval by calling OpenAI or by reintroducing keyword logic into the fake.
- Include multilingual/paraphrase fixtures that deliberately lack ASCII token overlap and unrelated
  fixtures with coincidental words. Assert vector outcome/contract, not generated writing quality.
- Test each query source and stable batch mapping, including repeated text deduplication and equal
  distance tie breakers.
- In PostgreSQL tests, seed eligible and ineligible rows spanning scenario, source status, type,
  profile/generation, source visibility, chunk visibility, and active avatar. Assert excluded data
  cannot win even when its vector is closer.
- Verify query vectors are rejected before SQL on wrong dimensions and stale profiles are excluded.
- Inspect repository spies/query logs to prove production retrieval does not call list-all methods.
  Search for `overlapScore`, `token-overlap`, metadata ranking boosts, and direct `<=>` usage outside
  the PostgreSQL repository.
- Exercise existing knowledge stack-e2e coverage for auth, validation, not-found where applicable,
  success, controlled failure envelope, and safe response fields. New endpoints, if any were truly
  necessary, require their own route-named `*.stack-e2e.test.ts` with the generator-mandated cases.
- Run focused unit/integration suites first, then typecheck, lint, full tests, stack-e2e/PostgreSQL
  suites, and build. Record environment-only skips without treating product failures as limitations.
- Update docs with query embedding, active-profile matching, cosine score semantics, SQL filtering,
  failure behavior, GM asymmetry, diagnostic fields, test ownership, and operator expectations.

## Constraints

- KISS, YAGNI, DRY; hardening must not add features.
- All normal tests are deterministic and network-free.
- No weakening visibility, profile, dimension, or database constraints to make tests pass.
- No raw prompts, query vectors, stored vectors, credentials, provider payloads, or unbounded content
  in diagnostics or test snapshots.
- Do not mark EPIC 5.1d complete while any definition-of-done item is unverified.

## Deliverables

- Requirements-to-tests matrix and closed coverage gaps.
- Deterministic semantic paraphrase/unrelated-text retrieval tests.
- Complete PostgreSQL filtering, ordering, dimension/profile, and index-compatibility coverage.
- Failure-isolation and no-fallback runtime tests.
- Production composition/call-site audit.
- Fully synchronized project, architecture, data, API, GM, memory, technology, EPIC, and testing docs.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: embedding profile/result/error, vector candidate, retrieval
   item/result/trace, knowledge source/chunk, session/Avatar options, GM state, admin DTO, runtime
   event, evaluation input, and Context Engine selection trace.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before hardening proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required and must describe actual production behavior;
- `docs/EPICS.md` — mark EPIC 5.1d complete only after every acceptance criterion passes;
- `docs/ARCHITECTURE.md` — query embedding, retrieval boundary, runtime consumers, and Context Engine ownership;
- `docs/DATA_MODEL.md` — active profile/corpus eligibility and vector score semantics;
- `docs/API_CONTRACT.md` — safe admin/runtime diagnostic fields and controlled failures;
- `docs/GAME_MASTER_CONTRACT.md` — unrestricted GM visibility and non-blocking failure behavior;
- `docs/MEMORY_SYSTEM_SPEC.md` — verify conversational memory ownership remains unchanged;
- `docs/TECH_STACK.md` — pgvector cosine retrieval and absence of a dedicated vector database;
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` — deterministic semantic and PostgreSQL coverage;
- relevant README, configuration, deployment, and operator documentation.

If a listed document needs no text change, record that it was reviewed and remains accurate. Code,
tests, and docs move together.

## Acceptance Criteria

- [ ] Semantic paraphrases retrieve the intended chunks without depending on shared lexical tokens.
- [ ] Unrelated or coincidental-word chunks do not outrank the intended semantic matches.
- [ ] PostgreSQL tests cover cosine ordering, all filters, limits, profile/dimension, and index compatibility.
- [ ] Avatar, GM, admin, inspection, and evaluation composition use one production vector service.
- [ ] Provider/repository failures preserve Avatar responses and required-evidence guidance.
- [ ] GM execution remains asynchronous and its visibility bypass remains explicit/observable.
- [ ] No production lexical/hash fallback, corpus scan, or alternate route-level ranker remains.
- [ ] Diagnostics are bounded, safe, complete, and distinguish retrieval from Context Engine trimming.
- [ ] Typecheck, lint, unit, integration, stack-e2e/PostgreSQL tests, and build pass or have documented environment limitations.
- [ ] All source-of-truth docs are current and EPIC 5.1d status is truthful.
