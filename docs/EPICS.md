# EPICS

## Purpose

Roadmap and delivery ledger for the MVP EPICs.

Each EPIC should remain:

- a coherent product increment
- testable in isolation
- understandable without commit history
- small enough to plan and verify deliberately

Reference documents:

- `ARCHITECTURE.md` defines structural boundaries.
- `PROJECT_STATUS.md` describes the current shipped platform.
- `API_CONTRACT.md`, `GAME_MASTER_CONTRACT.md`, and `MEMORY_SYSTEM_SPEC.md` hold contract-level detail.

Completed EPICs are summarized under `Shipped EPICS`; the backlog below contains only incomplete work.

## Shipped EPICS

### Foundations

#### `1.1 Core Platform Bootstrap` ✅ Done

Established the monorepo, Docker-based local stack, strict TypeScript baseline, Postgres + pgvector + Redis runtime, and the base module structure used by the platform.

#### `1.2 First LLM Loop + Observability` ✅ Done

Delivered the first provider-wrapped text exchange flow plus request tracing, latency/token metrics, and the initial observability baseline.

### Core Conversation Runtime

#### `2.1 Avatar Agent v1` ✅ Done

Delivered direct avatar replies with persona-driven multi-turn behavior, establishing the first differentiated conversational runtime.

#### `2.1b Avatar Agent v2` ✅ Done

Extended avatar prompt assembly so replies can use user persona, layered memory, and retrieval context instead of behaving like stateless responders.

#### `2.2 Scenario & Session Lifecycle v1` ✅ Done

Shipped the core scenario, avatar, session, and conversation lifecycle with persisted messages, history access, and session-level conversation management.

#### `2.2b Conversation Lifecycle v2` ✅ Done

Added bounded conversation closure, end-of-conversation handling, and the trigger that hands completed conversations into memory compaction.

#### `2.3 Persistence Layer v1` ✅ Done

Replaced in-memory core repositories with durable Postgres persistence and migrations for the main runtime entities.

#### `2.4 Manual Test Console v1` ✅ Done

Provided the first internal UI for creating content, starting sessions, sending messages, reviewing history, and resetting test sessions.

#### `2.5 Admin CRUD + Console Integration` ✅ Done

Completed the Tier 1 admin CRUD surface for scenarios, avatars, and sessions, then wired the console to those real admin APIs.

#### `2.6 GM Debug Panel v1 + Observability APIs` ✅ Done

Introduced safe GM inspection endpoints and a console debug panel for triggers, notes, transitions, unlocks, and orchestration state.

#### `2.7 Runtime Inspector v2` ✅ Done

Expanded the console into a runtime inspector covering context, memory layers, events, transitions, and operational actions.

#### `2.8 Console Debugging Redesign` ✅ Done

Consolidated fragmented debug flows into one operator shell with bounded workspaces for setup, memory evolution, GM impact, profiling, and persona editing.

### Operations And Runtime Control

#### `3.1 Operational Health & Dependency Monitoring` ✅ Done

Delivered health and dependency probes for core services so operators can detect degraded runtime conditions before users do.

#### `3.2 Inspector Consolidation & Contract Cleanup` ✅ Done

Consolidated session inspection around canonical DTO ownership, cleaner admin read paths, and one coherent operator inspection flow.

#### `3.3 Replay & Recovery Tools` ✅ Done

Closed on review (2026-10-18): GM replay, memory refresh/clear, and session reset are shipped, and
each operator action is recorded as an `admin_action.*` event in `event_log`. The remaining
permission-boundary scope moves to 12.1.

### Orchestration, Memory, And Runtime State

#### `4.1 Async Game Master v1` ✅ Done

Implemented non-blocking Game Master execution with structured decisions, routing influence, and deterministic runtime safeguards.

#### `4.1c Multi-Model Runtime Configuration` ✅ Done

Added deterministic model selection across global, role, scenario, and avatar scopes, together with admin editing and observability of effective model usage.

#### `4.1d Scenario Model Config Symmetry` ✅ Done

Completed symmetric four-slot scenario model selection (`defaultProfile`, `avatarOverride`, `gameMasterOverride`, and `memoryOverride`), including API/admin UI round-tripping, role-specific precedence, Postgres read-back, and independent avatar trait-preparation resolution through scenario default → global default.

#### `4.2 Memory Layer v1` ✅ Done

Introduced persistent user facts and prompt injection so the runtime can retain and reuse basic user memory across sessions.

#### `4.2b Memory System v2` ✅ Done

Added working memory and an async maintenance pipeline so long conversations no longer depend on replaying the full transcript.

#### `4.2c Memory System v3` ✅ Done

Completed the layered memory model with episodic memories, hydration, deterministic memory selection, and stronger debug visibility.

#### `4.3 Performance Baseline` ✅ Done

Instrumented per-turn latency, token usage, and runtime metrics so the team can measure cost and responsiveness objectively.

#### `4.4 Multi-Avatar Navigation v1` ✅ Done

Made avatar availability, unlocking, switching, and session-scoped navigation explicit parts of the runtime.

#### `4.5 Runtime State & World Events` ✅ Done

Added runtime-state snapshots and SSE event streaming so clients can react to async GM-driven world changes in realtime.

### Knowledge And Context

#### `5.1 Multi-Layer Knowledge & RAG System v1` ✅ Done

Delivered typed knowledge ingestion, chunking, embeddings, retrieval pipelines, and admin diagnostics for avatar, world, and media knowledge.

#### `5.1b Avatar-Scoped Knowledge Visibility` ✅ Done

Added avatar-scoped retrieval visibility so avatars only see allowed knowledge while the Game Master keeps unrestricted orchestration access.

#### `5.1c Real Embedding Infrastructure & Reindexing` ✅ Done

Delivered provider-neutral embeddings, production OpenAI integration, profile-aware persistence, transactional ingestion, safe reindexing, atomic corpus promotion, and authenticated operator controls.

#### `4.2d Memory Domain Separation` ✅ Done

Separated scenario-shared static knowledge from user-bound conversational memory with canonical types, explicit lifecycle ownership, and isolation coverage ([requirements matrix](EPIC_4_2D_REQUIREMENTS_MATRIX.md)).

#### `5.1d Vector Retrieval Runtime` ✅ Done

Established profile-aware pgvector retrieval for Avatar, Game Master, and admin flows, with deterministic merging, shared visibility rules, controlled failures, and shared diagnostics ([requirements matrix](EPIC_5_1D_REQUIREMENTS_MATRIX.md)). The later retrieval-quality hardening slice adds a bounded full-text candidate path for exact-entity recovery.

#### `5.1e Retrieval Quality Hardening` ✅ Done

Delivered the labelled recall@k/MRR harness, deterministic paragraph-aware chunk hard caps without overlap, native
1536-dimensional embeddings, authoritative Avatar selection, retrieval-diagnostic cleanup, bounded
lexical candidate fusion, and same-profile incremental reindexing. The six-fixture before/after
comparison records unchanged recall@3/7/9 at 1.000000 and an MRR improvement from 0.722222 to
0.916667, with mixed per-fixture rank movement documented in the harness report.

#### `5.2 Context Engine v2` ✅ Done

Established deterministic context assembly, precedence rules, token budgeting, trimming, and explainable trace output for Avatar and GM runtime contexts.

#### `5.5 User Persona System` ✅ Done

Persisted user persona and injected it into Avatar and GM flows so the runtime can adapt to the user’s role and interaction style.

### Authoring And User Surfaces

#### `6.1 Scenario Builder v1` ✅ Done

Delivered the admin authoring surface for scenario and avatar editing, knowledge-source management, visibility policy, and runtime model selection.

#### `7.1 Public User Web App v1` ✅ Done

Delivered the first player-facing web app with browser-owned identity, scenario discovery, available-avatar chat flow, and SSE-driven runtime updates.

#### `5.3 Streaming UX Layer` ✅ Done

Delivered additive message streaming with progressive Avatar rendering, ordered-delta handling, interruption cleanup, exact-once persistence, and backward-compatible JSON responses.

#### `6.2 AVA Scenario Validation` ✅ Done

Closed on review (2026-10-18): the AVA scenario runs on the deployed stack with Max and Emma, and
the Max evaluation suite (21 questions) passed 16–18 questions across five `gpt-5.6-luna` runs.
Adding characters is scenario configuration, not code. The ongoing quality bar moves to 12.4.

#### `6.3 Summer Prototype Delivery` ✅ Done

Closed on review (2026-10-18): Core runtime, API, admin, and player are deployed together and
operable without code changes. Player-facing experience work moves to 12.2.

### Phase A Refinements

#### `8.1 Avatar Trait Structuring` ✅ Done

Introduced explicit scenario-scoped avatar-trait preparation so runtime prompt assembly can consume canonical computed traits instead of ad hoc fields.

#### `8.2 Runtime Context Assembly Refactoring` ✅ Done

Refactored runtime context into structured sections with clearer precedence and tighter prompt assembly for Avatar behavior.

#### `8.3 Game Master Prompt Refinement` ✅ Done

Strengthened the Game Master prompt contract with explicit structure and clearer decision-policy guidance.

#### `8.4 Working Memory Prompt Refinement` ✅ Done

Refined working-memory generation around structured fields such as `coveredTopics` and aligned the related operator-facing inspection surfaces.

#### `8.5 Game Master Post-Analysis Refinement` ✅ Done

Refined asynchronous Game Master orchestration with forward retrieval planning, dialogue-control modes, dynamic routing, and explicit ownership boundaries for application state and memory compaction.

### Evaluation, Voice, And Platform Hardening

#### `8.6 Scripted Conversation Response Evaluation` ✅ Done

Added authenticated CLI evaluation for sequential scripted conversations, semantic judging, runtime metrics, partial reports, model comparison metadata, and deterministic test coverage.

#### `9.1 Voice Input Integration with Deepgram` ✅ Done

Added provider-neutral speech-to-text contracts, an optional Deepgram adapter, transcript coordination, authenticated sync/SSE routes, idempotency, cancellation, and hardening coverage. The web client uses it for a hands-free voice conversation: microphone capture with pause-based auto-send, streamed replies, and autoplayed reply audio.

#### `9.2 Voice Output Integration with Gradium` ✅ Done

Added provider-neutral text-to-speech contracts, an optional Gradium adapter, completed-message audio delivery, browser playback with text fallback, and hardening coverage.

#### `9.3 Voice Output with OpenAI` ✅ Done

Added an OpenAI text-to-speech adapter (WAV, Ogg/Opus, MP3; built-in multilingual voices),
registered when `OPENAI_API_KEY` is present and selectable per scenario/avatar or as the
`TTS_PROVIDER` default. Gradium and OpenAI share bounded audio reading and status mapping.

#### `9.4 Streamed Voice Output` ✅ Done

Reply audio streams from the provider through Core to the browser: the text-to-speech port yields
bounded chunks, the message-audio route forwards them and cancels synthesis on disconnect, and the
web client plays 24 kHz PCM through Web Audio as it arrives. The voice now starts about 0.3 s after
the text instead of after the whole clip (about 10 s for 400 characters); `firstAudioMs` and the
console's "voice starts after" show that wait.

#### `10.1 Clean-Slate Compatibility Removal` ✅ Done

Removed audited compatibility paths and legacy contracts, verified fresh schema/content deployment, and synchronized the source-of-truth documentation.

#### `11.1 Code Hygiene & Duplication Reduction` ✅ Done

Removed the confirmed D1-D4 dead-code clusters, established canonical ownership for R1-R7, and
consolidated only behaviorally equivalent Core, browser, provider, and stream helpers. Final strict
unused checks, lint, typecheck, build, and deterministic tests pass; public API, persistence,
provider, and runtime-order contracts remain unchanged.

#### `11.2 Comment Audit & Hack Removal` ✅ Done

Completed the comment inventory, removed documented legacy fallbacks and stale TODOs, and swept
noise comments across Core, shared contracts, clients, evaluation tools, Docker/config, and
workflows. Session unlock state is required end to end. The five oversized production modules were
split and 25 production lint suppressions were refactored away; the 48 that remain each name the
specific construct that keeps them. Added the local comment-policy ESLint rule, unused-disable
reporting, warning-comment checks, and RuleTester coverage. Public contracts and runtime behavior
are unchanged apart from the documented hack removals.

#### `12.1 Two-Tier Route Security` ✅ Done

Every route declares a `public`, `admin`, or `open` tier, enforced at startup and by a route-tier
matrix test; authoring CRUD, the raw exchange, and cross-user session management moved under
`/v1/admin`. Admins sign in with one operator password (scrypt) to a Redis-backed `HttpOnly`
cookie with a CSRF origin check; tools use a server-side service key. Players get a Core-issued
HMAC token, `userId` comes only from it, and another player's session or conversation returns
`404` before any body is read; player tokens get `403` on admin routes. Rate limits, per-tier body
limits, and per-tier CORS bound abuse. The shared `x-api-key` and `VITE_API_KEY` are gone, CI scans
the built bundles for secrets, and nginx sends CSP and framing headers.

#### `12.3 Multimedia: Media Assets, Slots, and Cues` ✅ Done

Scenario-scoped image and video assets (upload streamed to a filesystem volume behind
`IMediaStorage`, or URL) replace the retired `media` knowledge type; an open file route serves
uploads of active scenarios with `Range`. Presentation cover/portrait and intro, outro, and idle
slots reference assets, Avatars carry `onUnlock`/`onSwitchTo` media triggers, and the admin library
uploads (browser-read duration and poster), describes, and assigns them. Unlock and switch triggers
and validated Game Master `mediaCue` decisions (from a bounded, once-per-session catalogue) emit an
exactly-once `runtime.media_cue`; the player plays videos full screen and images as an overlay
after the character's speech, pauses the voice loop meanwhile, and reports playback so cue-to-play
timing is recorded per cue. Verified live: intro video at session start, a GM-cued image, and an
unlock video (`docs/implementation-prompts/epic-12-3-multimedia/verification-2026-10-19.md`).
Follow-ups: upload the real AVA intro film on the deployed stack; captions; an object-store
storage adapter when one volume is no longer enough.

## Open Backlog

Reviewed 2026-10-18 against the code, the evaluation reports, and the live AVA scenario. Order of
work: 12.4 and the 12.5 end-to-end metric first; then 12.2 and per-sentence speech; 12.6 last,
because it needs per-sentence audio (12.5); the player media layer (12.3) has shipped.

### `12.2 Public Experience UI`

**Current state**  
Implemented 2026-10-19; only the human validation is open. Scenario and Avatar presentation has
one typed shared contract stored in `uiHints` and authored in admin. The player follows landing →
intro → in-world question → character choice → conversation → outro (French first), with
character cards, starter questions, a voice-first screen with one announced presence state, an
optional transcript, staged unlock/suggestion moments, an idle hint, and Enter-to-send. It logs the
time to first exchange to the browser console. Remaining: the five hallway tests in
`implementation-prompts/epic-12-2-public-experience-ui/hallway-tests-2026-10-19.md`, and any fixes
they reveal. Intro media shipped with 12.3. Absorbs the player-facing scope of 6.3.

**Purpose**  
Turn the demo player into a guided experience a first-time visitor understands without help.

**Description**  
Rebuild `apps/web` as a guided flow with character presentation, voice-first states, and staged
runtime events; author the presentation data in admin and store it in scenario/avatar `uiHints`,
which Core orchestration ignores.

**Includes**

- flow: landing → intro (with 12.3 media) → one in-world question → character choice → conversation → outro
- character cards: portrait, one-line hook, two or three starter questions
- voice-first screen with listening / thinking / speaking states and optional transcript
- GM suggestions and unlocks presented as narrative moments
- idle hint when the visitor stalls
- Enter sends; Shift+Enter inserts a newline
- admin fields for cover, tagline, portrait, hook, and starter questions

**Definition of done**

- a first-time visitor reaches a first exchange in under 30 seconds without explanation
- debug-oriented views stay in `apps/console`

**What can be tested**

1. behavior tests for each flow state and transition
2. starter questions and portraits round-trip from admin to player
3. suggestion/unlock events render as staged moments
4. five hallway tests with recorded notes

**User increment**

- the public player feels like an experience instead of a test console

### `12.4 Discovery Quality & Measurement`

**Current state**  
`tools/conversation-evaluation` runs single questions checked against `requiredFacts` and
`forbiddenClaims` by an LLM judge. Five `gpt-5.6-luna` runs of the 21-question Max suite passed
16–18 questions; `totalCostUsd` is reported as null. Persona register, revelation pacing, guidance,
GM decisions, long-session coherence, and robustness are not measured. In a live test Max offered
three secrets in his first reply. Absorbs 5.4 (remaining progression tuning) and the quality bar
of 6.2.

**Purpose**  
Tune Avatar and Game Master prompts against measurements instead of impressions.

**Description**  
Extend the evaluation tool to multi-turn discovery scripts with deterministic and rubric checks,
then tune the Avatar persona prompt, GM decision policies, and retrieval parameters one change at a
time against an AVA baseline.

**Includes**

- definition v2: multi-turn scripts with per-turn assertions
- deterministic checks: sentence count, no list/menu formatting, language, secret not revealed before turn N
- rubric scores (1–5): in character, pacing, guidance when the user stalls
- GM assertions from runtime events: routing, unlock, dialogue mode, director-note adherence
- long-session (30-turn) and avatar-switch coherence scripts
- robustness probes: "are you an AI?", off-topic, hostile user
- simulated-visitor runs for open discovery
- five repetitions per run reporting mean and spread; cost reporting fixed
- judge calibration against ten human-rated sessions; golden set reviewed with Paradigma

**Definition of done**

- the AVA suite covers facts, persona, pacing, guidance, GM decisions, coherence, and robustness with a recorded baseline
- every Avatar/GM prompt change ships with a before/after report

**What can be tested**

1. deterministic checks are unit-tested against fixed transcripts
2. GM assertions read the recorded runtime events
3. repeated runs report variance
4. a regression threshold flags a drop in pass rate

**User increment**

- characters reveal their story at the right pace, and the team can prove it

### `12.5 Latency Reduction`

**Current state**  
The voice chain runs in series: the browser waits for 1,200 ms of silence (`voice-activity.ts`),
uploads the clip to Deepgram's pre-recorded `/v1/listen`, embeds the query and searches pgvector
before the LLM call, generates the full reply (1.7–2.6 s at about 3,400 input tokens in the eval
reports), and only then requests audio per saved message. Stage metrics exist, but there is no
end-to-end metric from the visitor's point of view. Absorbs 5.6/6.4 as one lever.

**Purpose**  
Cut the time from the end of the visitor's speech to the first audio of the reply.

**Description**  
Add the end-to-end metric first, then apply levers one at a time and measure each.

**Includes**

- headline metric: end of speech → first audio, p50/p90, shown in the console
- per-sentence speech: synthesize each finished sentence while the LLM streams
- streaming STT with end-of-turn detection instead of upload after silence
- prefetch the GM `retrievalPlan` for the next turn; cache query embeddings
- stable prompt prefix for provider prompt caching; first-token comparison across models/providers
- small canonical layer: pre-rendered greetings and backchannel audio

**Definition of done**

- the headline metric is recorded before and after each lever
- text-only and fallback paths keep working
- exactly-once message persistence is unchanged

**What can be tested**

1. sentence segmentation and ordered audio delivery
2. interruption cancels pending sentence synthesis
3. streaming STT finalizes one transcript per turn
4. metric breakdown sums to the end-to-end total

**User increment**

- replies start noticeably sooner in voice conversations

### `12.6 Video Avatar`

**Current state**  
No video port or adapter exists. Voice EPICs 9.1–9.4 provide the port/adapter/fallback pattern.
Candidate providers are compared on the GamiWays research portal.

**Purpose**  
Give characters a real-time face while keeping our voice, prompts, and Game Master.

**Description**  
Add a provider-neutral video port that lip-syncs our own TTS stream, with one adapter chosen after
a short spike, delivered to the player and measured.

**Includes**

- video port beside the TTS port; lip-sync on our audio as the default mode
- one-week spike on two candidates using the same AVA lines
- one adapter; WebRTC delivery to the player; idle and listening loops
- per-avatar provider and face settings in admin
- `firstFrameMs` and lip-sync offset metrics
- fallback to portrait + audio when video is off or fails

**Definition of done**

- one AVA character speaks on video in the player
- added latency over audio-only is measured
- text and voice paths are unchanged when video is unconfigured

**What can be tested**

1. adapter contract tests with a fake provider
2. fallback activates on provider failure
3. video stops with interrupted audio
4. latency metrics are recorded per turn

**User increment**

- visitors talk to a character they can see

## Superseded Or Absorbed Items

### `5.4 Guided Progression Engine v1`

Absorbed into 12.4. EPIC 8.5 already shipped dialogue-control modes, director notes,
`progressionUpdate`, retrieval planning, and unlock routing; the remaining work is tuning those
decisions against measurements.

### `5.6 / 6.4 Hybrid Response System / Hybrid Response Optimization`

Absorbed into 12.5 as one latency lever (pre-rendered greetings and backchannel audio). A broader
canonical-answer path is not planned unless latency measurements require it.

### `4.1b Game Master Context Awareness Upgrade`

Do not reopen this as a standalone EPIC unless the scope changes materially. Its intended outcome is already covered by shipped work in `5.1`, `5.1b`, `5.2`, `8.3`, and `8.4`.

## Future-Use Rules

- Create a new EPIC only for a coherent, testable product increment.
- Keep implementation history out of this file; detailed execution belongs in commits, PRs, and focused design docs.
- When an EPIC is absorbed by later work, mark it as absorbed instead of duplicating the same scope under multiple headings.
