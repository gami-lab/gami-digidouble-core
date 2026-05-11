# EPIC 5.1 — Multi-Layer Knowledge & RAG System v1

## Objective

Implement a unified knowledge pipeline that supports three retrieval domains with clear separation and traceability:

- Avatar Memory RAG (`memory`)
- World / Scenario RAG (`world`)
- Media RAG (`media`)

The implementation must preserve clean architectural boundaries, prevent contract drift, and keep retrieval behavior deterministic and inspectable.

## Generated

2026-05-11

## Dependencies Between Prompts

- `00-contract-cleanup.md` is mandatory before feature work.
- `01-knowledge-domain-and-persistence.md` defines canonical storage and repository contracts required by all later slices.
- `02-ingestion-pipeline-and-job-lifecycle.md` requires `01`.
- `03-retrieval-pipelines-by-type.md` requires `01` and uses ingested/chunked data from `02`.
- `04-api-contracts-and-stack-e2e.md` requires `01`, `02`, `03` to expose stable public/admin surfaces.
- `05-console-integration-hardening-doc-sync.md` is the closure slice and must run last.

## Ordered Execution List

| #   | File                                           | Purpose                                                                                |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| 0   | `00-contract-cleanup.md`                       | Remove/avoid contract duplication before adding new knowledge models and DTOs          |
| 1   | `01-knowledge-domain-and-persistence.md`       | Add domain models, schema updates, repositories, and ownership boundaries              |
| 2   | `02-ingestion-pipeline-and-job-lifecycle.md`   | Implement ingestion flow: source registration, chunking, embeddings, job status        |
| 3   | `03-retrieval-pipelines-by-type.md`            | Implement retrieval per type (`memory`, `world`, `media`) with deterministic selection |
| 4   | `04-api-contracts-and-stack-e2e.md`            | Add endpoint contracts and mandatory stack-e2e coverage                                |
| 5   | `05-console-integration-hardening-doc-sync.md` | Console/admin integration, observability hardening, full tests, full doc sync          |

## Suggested Execution Order

`00 -> 01 -> 02 -> 03 -> 04 -> 05`

## Definition of Done (Full EPIC)

- [ ] Canonical ownership exists for all new knowledge contracts (domain + HTTP/shared DTOs), with no duplicated response shapes.
- [ ] Data model supports typed knowledge sources and retrieval chunks with traceable metadata.
- [ ] Ingestion pipeline supports text-oriented and media-oriented sources with explicit job lifecycle states.
- [ ] Retrieval behavior is separated by domain (`memory`, `world`, `media`) and does not mix unrelated sources.
- [ ] Context assembly can consume typed retrieval outputs deterministically.
- [ ] New endpoints include mandatory `*.stack-e2e.test.ts` coverage for auth, validation, and not-found paths.
- [ ] Admin/debug surfaces expose inspectable ingestion and retrieval traces without leaking sensitive content.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:integration-e2e` pass.
- [ ] Documentation is updated, including `docs/PROJECT_STATUS.md` and any impacted contracts/data-model/architecture docs.
