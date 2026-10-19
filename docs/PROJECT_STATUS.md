# Project status

Last reviewed: 2026-10-18

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
- optional Deepgram speech input and Gradium or OpenAI text-to-speech delivery, selectable per scenario/avatar, with text-preserving fallback
- health, metrics, safe diagnostics, replay, reset, and memory/reindex operations
- provider/model selection and bounded observability behind internal ports, including symmetric
  four-slot scenario selection and independent scenario-default avatar trait preparation
- two-tier route security: admin sign-in (session cookie or server-side service key), Core-issued
  player tokens with session/conversation ownership, rate limits, body limits, per-tier CORS, and
  secret-free browser bundles
- typed player presentation (cover, tagline, intro, entry question, outro; portrait, hook, starter
  questions) authored in admin, stored in `uiHints`, and ignored by orchestration

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
- Static knowledge (`avatar_knowledge`, `world`) is separate from conversational memory,
  with independent lifecycle ownership — see `CONTEXT_CONTRACT_OWNERSHIP_MAP.md` for the full matrix.
- Avatar retrieval is visibility-filtered; GM unrestricted retrieval is explicit and still respects corpus/type/readiness rules.
- Active Avatars require prepared traits; active Scenarios require canonical language.
- Scenario language is the canonical BCP-47 language for Avatar text, speech recognition, and voice
  synthesis; a client `x-language` header cannot override a configured Scenario language.
- Voice input and text-to-speech are optional and provider-neutral behind application ports; the
  platform stays fully functional on text alone when Deepgram/Gradium/OpenAI voice are unconfigured, and no raw
  audio is persisted.
- Every route declares one tier; player routes take only a player token and never a client-chosen
  `userId`; a foreign session or conversation is indistinguishable from a missing one (`404`).
- Public/admin diagnostics never expose raw prompts, secrets, provider payloads, raw vectors, or unbounded transcripts.
- Fresh deployment uses the canonical PostgreSQL bootstrap; old compatibility volumes/contracts are not supported.
- `tools/conversation-evaluation` is an external client/tool boundary; its report types stay outside the Core domain and do not extend shared or Core contracts.

## Apps and tooling

- `apps/console` — the read-mostly debug surface for every LLM use: avatar trait preparation, the
  knowledge retrieval bench, and a live per-session turn timeline (latency breakdown, Avatar inputs,
  RAG results, GM decisions, memory updates) linking each LLM call to its Langfuse trace. Authoring
  lives in admin.
- `apps/web` — the guided public player: landing → intro → one in-world question → character cards
  with starter questions → voice-first conversation (portrait, one announced listening / thinking /
  speaking state, optional transcript, text fallback) → outro, with GM unlocks and suggestions
  staged as narrative moments and an idle hint. Core-issued player identity, SSE runtime updates,
  autoplayed reply audio streamed as PCM with text fallback, and a hands-free voice loop.
- `apps/admin` — the scenario-builder authoring app (scenarios, avatars, knowledge, model
  selection), behind the admin sign-in.
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

- The guided public player (`EPICS.md` 12.2) is implemented but not yet validated with the five
  first-time-visitor hallway tests; intro media waits for 12.3.
- Multimedia (`EPICS.md` 12.3) is in progress: the shared media contract, presentation media
  references, the media asset store (upload/URL, filesystem storage, open file route with `Range`)
  exist; the admin library, triggers, GM cues, and playback are not yet shipped.
- Evaluation measures factual recall only, not discovery pacing, persona, or GM decisions (`EPICS.md` 12.4).
- The voice chain runs in series and has no end-to-end latency metric (`EPICS.md` 12.5).
- No video avatar support (`EPICS.md` 12.6).
- Retrieval Quality Hardening (`EPICS.md` 5.1e) is complete: the six-fixture harness measured
  recall@3/7/9 = 1.000000 for both the historical 16-dimensional baseline and the current native
  1536-dimensional profile, while MRR improved from 0.722222 to 0.916667. The comparison records
  mixed per-fixture rank movement honestly; bounded lexical fusion addresses exact-entity fallback,
  same-profile reindexing skips unchanged chunk embeds, Context Engine owns final Avatar selection,
  unmeasurable visibility-exclusion counts are no longer emitted, and PostgreSQL integration
  fixtures seed rows directly at the test boundary rather than exposing a production chunk-write
  compatibility method.
- EPIC 11.1 is complete: the code audit, contract-ownership prerequisite, D1-D4 dead-code removal,
  R1-R7 client/mapper/composition/normalization/memory-window/provider/stream-helper cleanup, and
  final hardening verification are finished. The ownership matrix in `CODE_AUDIT.md` records the
  canonical owners and explicit keep-separate boundaries. The cleanup is behavior-preserving and
  does not change runtime ordering or public API contracts.
- EPIC 11.2 is complete: the comment baseline and decision inventory were recorded; documented
  legacy fallbacks, stale TODOs, compatibility paths, and production type escapes were removed;
  oversized production modules were split and the remaining lint suppressions carry specific
  reasons; and policy sweeps covered Core, shared contracts, clients, evaluation tools,
  Docker/config, and workflows. The local comment-policy rule, unused-disable
  reporting, and warning-comment checks now run through `pnpm lint` and staged-file linting. Public
  contracts and runtime behavior remain unchanged apart from the documented hack removals.
- EPIC 12.1 is complete: see `EPICS.md` for the shipped summary and `API_CONTRACT.md` for the tier,
  identity, ownership, and abuse-control rules.
- Phase A has one operator password and anonymous Core-issued player identities (no user
  accounts, roles, or OIDC; a player who clears the browser, or stays away longer than the token refresh window, starts
  as a new player), one Core deployment unit, optional
  provider integrations, and no audio persistence — sufficient for the current prototype scope, but
  worth revisiting before multi-tenant or external-user deployment.
- Stack/provider/database checks depend on the configured environment; deterministic package tests remain the default gate.

## Working rules

- Update this file only when a meaningful capability or limitation changes, not for every commit.
- Put durable decisions in the relevant contract document, not in a chronological implementation log.
- Put exact implementation evidence in tests, commits, and CI output.
