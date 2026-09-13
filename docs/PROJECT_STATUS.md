# Project status

Last reviewed: 2026-09-13

## Snapshot

Phase A is a working headless conversational runtime with a clean-slate current contract. The
shipped platform includes:

- persistent users, scenarios, Avatars, sessions, conversations, messages, and model configuration
- direct synchronous and SSE Avatar turns with interruption-safe persistence
- asynchronous Game Master planning, routing proposals, progression guidance, and runtime events
- bounded working, episodic, and user-fact memory with admin inspection and maintenance actions
- typed scenario knowledge ingestion, OpenAI embeddings, profile-aware pgvector retrieval, atomic reindexing, and Avatar visibility rules
- deterministic context assembly for Avatar and GM with separate conversation/retrieved-context projections
- API, admin, console, web, and authenticated scripted-evaluation consumers
- optional Deepgram speech input and Gradium-compatible text-to-speech delivery with text-preserving fallback
- health, metrics, safe diagnostics, replay, reset, and memory/reindex operations
- provider/model selection and bounded observability behind internal ports

## Architectural invariants

- `API -> Application -> Domain -> Infrastructure` layering is enforced.
- `packages/shared` owns public/shared DTOs; Core maps internal entities explicitly.
- Avatar answers without waiting for GM or memory work.
- Static knowledge (`avatar_knowledge`, `world`, `media`) is separate from conversational memory.
- Avatar retrieval is visibility-filtered; GM unrestricted retrieval is explicit and still respects corpus/type/readiness rules.
- Active Avatars require prepared traits; active Scenarios require canonical language.
- Public/admin diagnostics never expose raw prompts, secrets, provider payloads, raw vectors, or unbounded transcripts.
- Fresh deployment uses the canonical PostgreSQL bootstrap; old compatibility volumes/contracts are not supported.

## Current limitations

- No standalone guided progression engine beyond current GM/scenario behavior.
- No hybrid response/cache path.
- No completed real-scenario validation milestone or prototype packaging milestone.
- Phase A has API-key auth, one Core deployment unit, optional provider integrations, and no audio persistence.
- Stack/provider/database checks depend on the configured environment; deterministic package tests remain the default gate.

## Working rules

- Update this file only when a meaningful capability or limitation changes.
- Put durable decisions in the relevant contract document, not in a chronological implementation log.
- Put exact implementation evidence in tests, commits, and CI output.
