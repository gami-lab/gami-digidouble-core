# EPIC 5.1d — Real Vector Retrieval Runtime

## Objective

Replace production token-overlap ranking with profile-compatible PostgreSQL/pgvector cosine
nearest-neighbor search. Use one vector retrieval boundary for Avatar, Game Master, admin, runtime
inspection, and evaluation paths while preserving visibility, bounded selection, and Context Engine
ownership.

## Generated

2026-09-06

## Prerequisite

Complete EPIC 5.1c first. This pack relies on its provider-neutral batch embedding port, active
embedding profile, profile-tagged corpus, fixed vector dimension, and production provider wiring.
Do not recreate those capabilities locally in retrieval code. If 5.1c contracts differ from its
prompt pack, use the implemented canonical contracts and document the variance before proceeding.

## Dependencies Between Prompts

- `00-retrieval-contract-cleanup.md` is mandatory first because retrieval item, query variant,
  trace, recorded-event, and shared DTO shapes currently overlap across layers.
- `01-runtime-query-embedding.md` depends on `00` and the completed EPIC 5.1c embedding/profile
  boundary; it batches ordered query variants and defines controlled failure behavior.
- `02-pgvector-nearest-neighbor-repository.md` depends on `00` and adds the repository port plus
  SQL-side scope, visibility, profile, and cosine ordering.
- `03-vector-retrieval-service-and-runtime-wiring.md` depends on `01` and `02`; it removes lexical
  production ranking, preserves balanced bounded selection, and wires Avatar and GM flows.
- `04-diagnostics-admin-and-evaluation-integration.md` depends on `03`; it aligns admin,
  inspection, event, and evaluation consumers with safe vector diagnostics.
- `05-quality-hardening-and-doc-sync.md` runs last and proves semantic quality, PostgreSQL query
  behavior, non-blocking failures, production composition, and documentation completeness.

## Ordered Execution List

| #   | File                                                 | Purpose                                                                         |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| 0   | `00-retrieval-contract-cleanup.md`                   | Establish canonical vector-result, query, failure, and diagnostics contracts    |
| 1   | `01-runtime-query-embedding.md`                      | Batch-embed ordered query variants with the active profile and safe telemetry   |
| 2   | `02-pgvector-nearest-neighbor-repository.md`         | Implement filtered, profile-compatible cosine search in PostgreSQL              |
| 3   | `03-vector-retrieval-service-and-runtime-wiring.md`  | Replace lexical ranking and use the service in Avatar and asynchronous GM paths |
| 4   | `04-diagnostics-admin-and-evaluation-integration.md` | Unify admin, runtime inspection, and direct evaluation retrieval paths          |
| 5   | `05-quality-hardening-and-doc-sync.md`               | Close quality, failure, SQL-plan, integration, and documentation gaps           |

## Suggested Execution Order

`00 -> (01 + 02) -> 03 -> 04 -> 05`

Prompts `01` and `02` may be implemented in parallel after `00`, but `03` must integrate their
final contracts rather than temporary copies.

## Definition Of Done For Full EPIC

- [ ] Every runtime query variant is embedded in a batch through the EPIC 5.1c provider-neutral port, preserving source and order.
- [ ] Query vectors and eligible stored chunks use the same active provider/model/dimension profile.
- [ ] `IKnowledgeChunkRepository` exposes one canonical vector-search operation with documented cosine distance/similarity semantics.
- [ ] PostgreSQL applies scenario, ready-source, type, visibility, active-avatar, static scope, and embedding-profile constraints before nearest-neighbor limiting.
- [ ] PostgreSQL orders candidates with pgvector cosine distance and uses an index-compatible query shape.
- [ ] Production retrieval neither loads every eligible chunk nor uses token overlap or metadata score boosts.
- [ ] Avatar, asynchronous GM, admin diagnostics, runtime inspection, and direct evaluation tooling use the same vector retrieval service.
- [ ] GM visibility bypass is explicit in input and safely observable; Avatar visibility remains enforced.
- [ ] Per-type limits, query-source minimums, duplicate removal, required-retrieval handling, and Context Engine budgets remain correct.
- [ ] Embedding failures produce a controlled empty/failure result, never lexical fallback, and never block the Avatar response.
- [ ] Safe traces expose profile identity, embedding/search latency, counts, matched query source, score/distance, exclusions, and final inclusion/trimming without raw vectors or unbounded content.
- [ ] Deterministic tests prove semantic paraphrases win over unrelated chunks without live provider calls.
- [ ] PostgreSQL integration tests prove ordering, filtering, dimensions/profile isolation, visibility, and index-compatible query behavior.
- [ ] All checks pass and `docs/PROJECT_STATUS.md`, `docs/EPICS.md`, architecture, data model, API, GM, and testing docs describe the shipped behavior accurately.
