# EPIC 5.1c — Real Embedding Infrastructure & Reindexing

## Objective

Replace production hash vectors with a provider-neutral, dimension-aware embedding capability and
an OpenAI adapter. Introduce one explicit active embedding profile and a safe, observable reindex
workflow that builds a complete replacement corpus before atomically promoting that profile.

## Generated

2026-09-05

## Dependencies Between Prompts

- `00-embedding-contract-cleanup.md` is mandatory first because the EPIC extends the existing
  `KnowledgeChunk`, embedding-port, ingestion, configuration, and persistence contracts.
- `01-openai-embedding-adapter.md` depends on `00` and implements the provider-neutral port,
  typed failures, observability boundary, OpenAI adapter, and production composition.
- `02-profile-and-corpus-persistence.md` depends on `00` and `01`; it establishes persisted profile,
  reindex-operation, corpus-generation, and fixed-dimension PostgreSQL invariants.
- `03-profile-aware-ingestion.md` depends on `02`; it makes normal ingestion transactional and
  rejects stale or incompatible profile work.
- `04-safe-full-reindexing.md` depends on `02` and `03`; it builds the retryable replacement corpus
  and adds the minimal authenticated operator controls required to start and inspect reindexing.
- `05-hardening-tests-and-doc-sync.md` runs last and verifies the complete lifecycle, failure
  recovery, production wiring, and documentation.

## Ordered Execution List

| #   | File                                   | Purpose                                                                                                    |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0   | `00-embedding-contract-cleanup.md`     | Establish canonical profile, result, failure, and knowledge-vector contract ownership                      |
| 1   | `01-openai-embedding-adapter.md`       | Implement validated OpenAI batch embeddings and remove hash embeddings from production defaults            |
| 2   | `02-profile-and-corpus-persistence.md` | Add fixed-dimension vector storage, profile metadata, staging generations, and atomic promotion primitives |
| 3   | `03-profile-aware-ingestion.md`        | Make ingestion use one active profile and transactionally publish only complete, current vectors           |
| 4   | `04-safe-full-reindexing.md`           | Implement idempotent full reindex orchestration, retry/status behavior, and operator API coverage          |
| 5   | `05-hardening-tests-and-doc-sync.md`   | Close coverage gaps, prove mixed-vector-space prevention, and synchronize all documentation                |

## Suggested Execution Order

`00 -> 01 -> 02 -> 03 -> 04 -> 05`

Prompts `01` and the persistence design portion of `02` may be reviewed in parallel, but prompt
`02` must consume the canonical contracts from `00` and the adapter metadata behavior from `01`.

## Definition Of Done For Full EPIC

- [ ] Application and Domain code depend only on a provider-neutral embedding port, never provider SDK types.
- [ ] Batch results preserve input order and expose provider, model, dimensions, and provider usage metadata.
- [ ] Invalid input, provider failure, rate limiting, malformed response, and dimension mismatch are explicit, testable failures.
- [ ] Production composition uses the configured OpenAI embedding adapter; the hash adapter is test-only and is never a silent fallback.
- [ ] Embedding configuration is independent from Avatar, Game Master, memory, and other chat-model selection.
- [ ] One canonical active embedding profile governs ingestion, query-vector generation, database validation, and retrieval corpus eligibility.
- [ ] PostgreSQL stores fixed-dimension production vectors plus profile/corpus metadata and recreates the cosine vector index safely.
- [ ] Active retrieval cannot observe mixed embedding profiles or a partially built replacement corpus.
- [ ] Normal ingestion replaces one source's chunks transactionally and cannot mark stale or incomplete vectors ready.
- [ ] A provider, model, or dimension change creates an idempotent, observable, retryable full reindex before profile promotion.
- [ ] Reindex failures identify failed sources and leave the previous valid corpus active where possible.
- [ ] Query text has a profile-aware embedding path ready for EPIC 5.1d without implementing nearest-neighbor retrieval.
- [ ] Any new reindex HTTP endpoints have route tests and `*.stack-e2e.test.ts` coverage for auth, validation, not-found where applicable, and success/status behavior.
- [ ] Unit, integration, and PostgreSQL tests cover batching, failures, dimensions, profile changes, concurrent reads, atomic promotion, and retry recovery.
- [ ] `docs/PROJECT_STATUS.md`, `docs/EPICS.md`, and all impacted architecture, data-model, API, configuration, and testing docs are accurate when implementation is complete.
