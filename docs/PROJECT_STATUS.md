# Project status

Last reviewed: 2026-09-14

## Snapshot

Phase A is a working headless conversational runtime with a clean-slate current contract. The
shipped platform includes:

- persistent users, scenarios, Avatars, sessions, conversations, messages, and model configuration
- direct synchronous and SSE Avatar turns with interruption-safe persistence
- asynchronous Game Master planning, routing proposals, progression guidance, and runtime events
- bounded working, episodic, and user-fact memory with admin inspection and maintenance actions
- typed scenario knowledge ingestion, OpenAI embeddings, profile-aware pgvector retrieval, atomic reindexing, and Avatar visibility rules
- versioned retrieval-quality fixtures with an opt-in historical 16-dimension baseline and current
  1536-dimension recall@k/MRR reporting
- deterministic context assembly for Avatar and GM with separate conversation/retrieved-context projections
- API, admin, console, web, and authenticated scripted-evaluation consumers
- optional Deepgram speech input and Gradium-compatible text-to-speech delivery with text-preserving fallback
- health, metrics, safe diagnostics, replay, reset, and memory/reindex operations
- provider/model selection and bounded observability behind internal ports

See `EPICS.md` for the delivery ledger behind each capability and the open backlog. Contract-level
detail for a specific area belongs in its owning document (`GAME_MASTER_CONTRACT.md`,
`MEMORY_SYSTEM_SPEC.md`, `API_CONTRACT.md`, `DATA_MODEL.md`) rather than here.

## Architectural invariants

- `API -> Application -> Domain -> Infrastructure` layering is enforced.
- `packages/shared` owns public/shared DTOs and cross-cutting contract types (SSE frame parsing,
  streaming/voice contract shapes); route-local contract duplication should not be reintroduced.
- Avatar answers without waiting for GM or memory work; GM and memory maintenance always run after
  the reply, never before or in place of it.
- GM decisions pass through runtime guards before they affect session state; conversation lifecycle
  ownership stays with the platform's switch use case, not the GM itself.
- Streaming persists exactly one completed Avatar message and never a partial one; provider or
  client interruption closes the active iterator and skips remaining post-turn work.
- Static knowledge (`avatar_knowledge`, `world`, `media`) is separate from conversational memory,
  with independent lifecycle ownership — see `CONTEXT_CONTRACT_OWNERSHIP_MAP.md` for the full matrix.
- Avatar retrieval is visibility-filtered; GM unrestricted retrieval is explicit and still respects corpus/type/readiness rules.
- Active Avatars require prepared traits; active Scenarios require canonical language.
- Scenario language is the canonical BCP-47 language for Avatar text, speech recognition, and voice
  synthesis; a client `x-language` header cannot override a configured Scenario language.
- Voice input and text-to-speech are optional and provider-neutral behind application ports; the
  platform stays fully functional on text alone when Deepgram/Gradium are unconfigured, and no raw
  audio is persisted.
- Public/admin diagnostics never expose raw prompts, secrets, provider payloads, raw vectors, or unbounded transcripts.
- Fresh deployment uses the canonical PostgreSQL bootstrap; old compatibility volumes/contracts are not supported.
- `tools/conversation-evaluation` is an external client/tool boundary; its report types stay outside the Core domain and do not extend shared or Core contracts.

## Apps and tooling

- `apps/console` — the local operator/debug surface: runtime inspection, GM/memory debugging,
  persona editing, and the scenario-builder authoring flows (scenario/avatar editing, knowledge-source
  management, visibility policy, and model selection).
- `apps/web` — the public player-facing chat surface: browser-owned identity, scenario discovery,
  available-avatar chat, SSE-driven runtime updates, and optional completed-message audio playback
  with text-preserving fallback.
- `apps/admin` — the admin CRUD API surface backing console authoring flows.
- `tools/conversation-evaluation` — an external, authenticated CLI for scripted-conversation
  evaluation: semantic judging through an LLM judge, runtime latency/token metrics, per-model
  comparison reports, and a local dependency-free report viewer. It reuses shared API contracts and
  is not a Core dependency; its report/definition types are tool-owned, not Core or shared types.

## Verification

A full gate is lint, typecheck, build, and every package's unit test suite — this is the default,
credential-free bar for merging. Stack E2E, PostgreSQL repository integration, and live-provider
smoke checks are environment-gated and skip cleanly with a preflight reason when the stack,
database, or provider credentials are unavailable (see `TEST_STRATEGY.md` for the exact gating
variables); they are not required for a normal PR but should be run before a release or a change
that touches persistence, retrieval, or provider adapters.

## Current limitations

- No standalone guided progression engine beyond current GM/scenario heuristics (`EPICS.md` 5.4).
- No hybrid response/cache path for latency-sensitive or canonical answers (`EPICS.md` 5.6/6.4).
- No completed real-scenario validation milestone or prototype-packaging milestone yet (`EPICS.md` 6.2/6.3).
- Retrieval Quality Hardening (`EPICS.md` 5.1e) is complete: the six-fixture harness measured
  recall@3/7/9 = 1.000000 for both the historical 16-dimensional baseline and the current native
  1536-dimensional profile, while MRR improved from 0.722222 to 0.916667. The comparison records
  mixed per-fixture rank movement honestly; bounded lexical fusion addresses exact-entity fallback,
  same-profile reindexing skips unchanged chunk embeds, Context Engine owns final Avatar selection,
  unmeasurable visibility-exclusion counts are no longer emitted, and the direct Postgres chunk-write
  method is documented as a fixture/in-memory compatibility path.
- The code audit is complete, but dead-code removal and duplication cleanup remain open under
  `EPICS.md` 11.1; the planned work is cleanup-only and is not expected to change runtime behavior
  or public API contracts.
- Phase A has API-key auth only (no user accounts/roles), one Core deployment unit, optional
  provider integrations, and no audio persistence — sufficient for the current prototype scope, but
  worth revisiting before multi-tenant or external-user deployment.
- Stack/provider/database checks depend on the configured environment; deterministic package tests remain the default gate.

## Working rules

- Update this file only when a meaningful capability or limitation changes, not for every commit.
- Put durable decisions in the relevant contract document, not in a chronological implementation log.
- Put exact implementation evidence in tests, commits, and CI output.
