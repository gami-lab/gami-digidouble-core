# Implement The OpenAI Embedding Adapter And Production Wiring

## Context

EPIC 5.1c requires production ingestion to use meaningful provider-generated vectors. The
repository already depends on the OpenAI SDK and has a centralized OpenAI credential boundary, but
production server composition currently defaults to `HashEmbeddingAdapter`.

This slice implements OpenAI behind the provider-neutral embedding port, validates every response,
and makes embedding configuration explicit and independent from chat-model selection.

## Scope

Implement now:

- add explicit embedding provider, model, dimension, and safe batch-size configuration;
- implement an Infrastructure OpenAI embedding adapter using the existing OpenAI API key/client boundary;
- split requests into deterministic batches within configured/provider limits and preserve global input order;
- validate response indices/count, numeric finite vectors, effective model where available, and every vector dimension;
- translate invalid input, rate limits, provider failures, malformed responses, and dimension mismatch into canonical failures;
- capture latency, usage, effective profile, batch count, and bounded failure diagnostics through the existing observability boundary;
- wire the real adapter as the production OpenAI embedding implementation and remove every implicit
  production hash fallback.

Out of scope:

- additional provider adapters;
- database migrations, corpus staging, and profile promotion;
- reindex orchestration;
- nearest-neighbor retrieval.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- OpenAI's official embeddings guide and SDK documentation for the installed SDK version

## Implementation Guidance

- Place the adapter under `apps/core/src/infrastructure/knowledge/` or a focused embeddings
  directory; provider SDK usage must remain Infrastructure-only.
- Reuse the installed `openai` package and existing `OPENAI_API_KEY` configuration boundary. Do not
  add a second credential or instantiate provider clients inside business logic.
- Add embedding-specific configuration fields/environment variables. Do not derive them from
  `LLM_PROVIDER`, role model config, Avatar config, Game Master config, or memory model config.
- Choose and document one supported production default profile (including its fixed dimension), or
  fail fast if the repository's configuration policy requires explicit values. Model and dimension
  must be validated as a compatible pair before the server accepts ingestion work.
- Reject an empty batch and blank/non-string inputs according to the canonical port contract before
  making a provider request. Avoid sending more inputs than the configured safe batch size.
- Reassemble provider items by their returned input index rather than assuming response array order;
  then verify exactly one vector exists for every input.
- Use the existing observability abstraction or a narrow embedding-specific extension. Record safe
  model/profile identifiers, duration, input/usage totals when supplied, batch count, outcome, and
  bounded error code; never record full source text, credentials, or raw unbounded responses.
- Production startup must fail clearly for an unsupported embedding provider or missing required
  credentials. Tests may inject the deterministic fake explicitly.
- Unit-test with a fake OpenAI client/transport. Keep live-provider integration tests opt-in and
  skipped when credentials are absent.

## Constraints

- Respect current architecture and dependency injection.
- KISS, YAGNI, DRY.
- No provider-specific types in Domain or Application.
- No `ILlmAdapter` extension for embeddings.
- No silent fallback to hash vectors, null vectors, or another model.
- Do not log input text, vectors, API keys, or full provider payloads.
- Do not add another embedding provider before its supported contract is confirmed.

## Deliverables

- Embedding-specific validated configuration.
- OpenAI adapter with stable batching, ordering, metadata, and error translation.
- Safe latency, usage, and failure observability.
- Production composition using the configured real adapter.
- Unit tests plus an opt-in live integration test if consistent with current provider-test patterns.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: embedding profile/results/errors, `Config`, OpenAI client
   construction, observability traces, and application composition.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types and provider factories where possible.
5. If no canonical owner exists, create one before feature work proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/ARCHITECTURE.md` for provider-neutral embeddings and production composition;
- `docs/TECH_STACK.md` for supported embedding provider/model configuration;
- `docs/DATA_MODEL.md` if profile semantics changed;
- `docs/API_CONTRACT.md` if observable public/admin output changed;
- `docs/TEST_STRATEGY.md` or `docs/TEST_COVERAGE_PLAN.md` for provider-test rules;
- configuration examples and deployment documentation that enumerate environment variables;
- `docs/EPICS.md` only when status is accurate.

If no additional documentation changes are needed, explicitly verify that every impacted document
is still accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] OpenAI embedding requests go only through the Infrastructure adapter.
- [ ] Batches preserve original input order across multiple provider calls.
- [ ] Count, index, finite-number, and configured-dimension validation reject malformed results.
- [ ] Rate limits and other provider failures retain actionable provider-neutral failure codes.
- [ ] Metrics include safe profile, batch, latency, usage, and outcome information.
- [ ] Embedding model selection is independent from all chat roles.
- [ ] Production never defaults or falls back to hash embeddings.
- [ ] Deterministic tests cover batching, ordering, failures, and dimension mismatch.
