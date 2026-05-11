## Purpose

This document defines the **EPICs for the MVP roadmap**.

Each EPIC:

- groups several related checklist items into one meaningful delivery block
- fits within **one sprint** when possible
- delivers a **testable increment**
- validates a **key hypothesis or risk**
- remains understandable in isolation

## EPIC Granularity Rule

We do **not** create one EPIC per checkbox.

Checkboxes are execution tasks.  
EPICs are coherent value blocks.

This avoids fragmentation, excessive management overhead, and false progress signals.  
Granularity can be refined later if some EPICs become too large or unclear.

---

# Phase A — Minimal Core (April → July 2026)

## Goal

Build and validate a **Core Engine (text-in → orchestration → text-out)** that:

- produces coherent conversations
- manages context efficiently
- remains performant
- is measurable
- is usable through a back-office
- is ready for a summer prototype

---

# Sprint 1 — Foundations ✅ Done

---

## EPIC 1.1 — Core Platform Bootstrap ✅ Done

**Purpose**  
Create the technical foundation for all future work.

**Description**  
Set up the monorepo, local runtime environment, Docker stack, modular monolith structure, and developer workflow.

**Hypothesis**  
A clean local-first foundation increases delivery speed and reduces future rework.

**Includes**

- GitHub repo
- pnpm / turborepo monorepo
- Docker local stack
- app + PostgreSQL + pgvector + Redis
- base module structure
- developer scripts

**DoD**

- full stack runs locally
- new developer can start in reasonable time
- project structure is clear

**What Can Be Tested**

- local install from scratch
- containers start correctly
- app boot success
- CI quality gates run

**User Increment**

- developers can run and work on the platform locally

---

## EPIC 1.2 — First LLM Loop + Observability ✅ Done

**Purpose**  
Validate end-to-end AI interaction immediately.

**Description**  
Implement the first wrapper-based LLM call and capture metrics from day one.

**Hypothesis**  
Observability early prevents blind architecture decisions later.

**Includes**

- LLM wrapper
- first text-in / text-out exchange
- logging wrapper
- latency / token / cost tracking
- basic metrics visibility

**DoD**

- user message returns model response
- metrics captured for every call
- wrappers isolate providers/tools

**What Can Be Tested**

- call `/v1/exchange`
- receive model reply
- invalid auth rejected
- metrics emitted for each request

**User Increment**

- first usable AI endpoint available for experimentation

---

# Sprint 2 — First Usable Product Slice

---

## EPIC 2.1 — Avatar Agent v1 ✅ Done

**Purpose**  
Create the first believable conversational entity.

**Description**  
Build an Avatar that answers directly with personality, memory hooks, and in-character behavior.

**Hypothesis**  
A differentiated avatar creates more value than generic chatbot behavior.

**Includes**

- persona prompt structure
- tone/personality controls
- direct reply flow
- session identity continuity

**DoD**

- avatar sustains coherent multi-turn exchange
- avatar feels distinct

**What Can Be Tested**

- converse several turns with avatar
- verify personality consistency
- compare generic bot vs avatar feel

**User Increment**

- first differentiated conversational experience

---

## EPIC 2.1b — Avatar Agent v2 (Memory + Persona + RAG Awareness)

**Purpose**
Evolve avatars from stateless responders into context-aware actors.

**Description**
Extend Avatar behavior to incorporate:

- user persona awareness
- short-term memory (last exchanges)
- long-term memory (via memory layer)
- RAG retrieval (avatar + media)

This EPIC does NOT change base architecture — it enriches prompt assembly and context injection.

**Hypothesis**
Context-aware avatars significantly improve perceived intelligence and coherence.

**Includes**

- user persona injection into avatar prompt
- memory hooks (read-only at this stage)
- RAG retrieval hooks
- media reference capability (non-rendering)

**DoD**

- avatar responses reflect user role (e.g. psychologist vs friend)
- avatar references past interactions naturally
- avatar can surface external knowledge/media

**What Can Be Tested**

- same question → different answer depending on user persona
- avatar recalls past interaction without full history
- avatar references external knowledge source

**User Increment**

- avatars feel adaptive and aware, not reactive

---

## EPIC 2.2b — Conversation Lifecycle v2 (End Signal + Compaction Trigger) ✅ Done

**Purpose**
Introduce realistic conversation boundaries and prepare memory transitions.

**Description**

Extend conversation lifecycle:

- introduce **explicit or implicit conversation end signal**
- trigger memory compaction at conversation end
- prepare transition from conversation → memory

This EPIC prepares memory behavior but does not yet implement full pyramidal memory.

**Hypothesis**
Explicit lifecycle improves memory quality and system scalability.

**Includes**

- conversation close endpoint or heuristic
- end-of-conversation detection rules
- trigger hook for memory compaction
- session state update on conversation end

**DoD**

- conversations can be explicitly closed
- memory compaction is triggered at closure
- new conversation does not rely on full history replay

**What Can Be Tested**

- close conversation → memory summary updated
- new conversation uses summary instead of history
- system behaves correctly without full transcript

**User Increment**

- conversations feel bounded and structured

---

## EPIC 2.2 — Scenario & Session Lifecycle v1 ✅ Done

**Purpose**  
Make the platform continuously usable through real conversations.

**Description**  
Implement minimal admin creation of scenarios/avatars plus session + conversation lifecycle: create session, start conversation in session, persist messages by conversation, and read conversation history.

**Hypothesis**  
Real usable sessions require manageable content objects and persistent conversation state.

**Includes**

- create scenario endpoint
- create avatar endpoint
- create session endpoint
- start conversation endpoint
- message persistence by conversation
- conversation history endpoint
- session-level conversation listing
- session status management

**DoD**

- operator can create scenario + avatar
- user can create a session, start one or more conversations, and converse across turns
- history is preserved per conversation
- returning to the same avatar can create a new conversation in the same session

**What Can Be Tested**

1. create scenario
2. create avatar
3. create session
4. start conversation
5. send messages
6. reload conversation history

**User Increment**

- first complete end-to-end conversation flow

---

## EPIC 2.3 — Persistence Layer v1 ✅ Done

**Purpose**  
Replace in-memory stubs with a production-ready PostgreSQL persistence layer.

**Description**  
Implement real Postgres repository adapters for all core domain entities (Scenario, Avatar, Session, Message), write DB migrations, and wire the adapters into the server. After this EPIC, no domain data is lost on server restart.

**Hypothesis**  
Production persistence is a prerequisite for any real user session, scenario validation, or operational tooling.

**Includes**

- DB schema migrations (scenarios, avatars, sessions, messages tables)
- `PostgresScenarioRepository` (create, findById)
- `PostgresAvatarRepository` (create, findById) — adds `createdAt`/`updatedAt` to `AvatarConfig`, resolving the timestamp synthesis gap from EPIC 2.2
- `PostgresSessionRepository` (create, findById, update)
- `PostgresMessageRepository` (save, findBySessionId, deleteBySessionId)
- Connection pooling (pg driver, configured via `DATABASE_URL`)
- Migration tooling integrated into dev workflow and CI
- `ServerAdapters` wires Postgres repositories in production/staging; in-memory stubs remain for unit tests only

**DoD**

- all domain data persists across server restarts
- all existing unit tests still pass using in-memory stubs
- integration tests validate each Postgres repository against a real DB
- `AvatarConfig` carries `createdAt` / `updatedAt` returned from the DB write
- DB schema matches `DATA_MODEL.md` exactly
- migration runs automatically on startup (or via explicit command)
- `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass

**What Can Be Tested**

1. create scenario → restart server → GET scenario still exists
2. create avatar → restart server → avatar still exists
3. start session → send messages → restart server → history intact
4. reset session → messages deleted → confirmed via history endpoint
5. DB schema matches DATA_MODEL.md documentation

**User Increment**

- first production-durable conversations: nothing is lost between deployments or restarts

---

## EPIC 2.4 — Manual Test Console v1 ✅ Done

**Purpose**  
Allow rapid testing by developers and non-developers.

**Description**  
Create a lightweight back-office UI to create scenarios, avatars, sessions, send messages, inspect history, and reset sessions.

**Hypothesis**  
A visible manual testing loop accelerates quality more than backend-only progress.

**Includes**

- simple chat UI
- scenario creation form
- avatar creation form
- create session flow
- history viewer
- reset button
- basic debug metadata display

**DoD**

- non-developer can test the platform end-to-end without code

**What Can Be Tested**

- full product flow via UI only
- manual QA sessions
- rapid avatar prompt iteration

**User Increment**

- first usable internal back-office tool

---

## EPIC 2.5 — Admin CRUD Completion + Console Integration ✅ Done

**Purpose**
Make the platform operationally manageable through complete admin CRUD flows directly usable from the console.

**Description**
Implement missing Tier 1 CRUD endpoints for scenarios, avatars, and sessions, then upgrade the manual console to consume these APIs for real administration instead of partial seed/demo flows.

**Hypothesis**
A complete admin plane accelerates testing, reduces developer dependency, and turns the console into a true back-office tool.

**Includes**

- `GET /v1/scenarios`
- `PATCH /v1/scenarios/{scenarioId}`
- `DELETE /v1/scenarios/{scenarioId}`
- `PATCH /v1/avatars/{avatarId}`
- `DELETE /v1/avatars/{avatarId}`
- `GET /v1/sessions`
- `POST /v1/sessions/{sessionId}/reset`
- scenario list/edit/delete UI
- avatar edit/delete UI
- session list/filter/reset UI
- dependency-safe delete conflict handling
- repository + API contract updates

**DoD**

- operator can manage scenarios without code changes
- operator can edit avatar prompts/configuration from UI
- operator can inspect and reset sessions from UI
- delete safety rules return clear conflicts
- console uses real APIs end-to-end

**What Can Be Tested**

1. create scenario → list appears in console
2. edit scenario → changes persist after reload
3. edit avatar → updated behavior visible in next session
4. blocked delete returns `409 CONFLICT`
5. list sessions ordered by recent activity
6. reset session preserves session record and clears runtime state
7. full admin flow works from UI only

**User Increment**

- first usable internal admin console with real content lifecycle management

---

## EPIC 2.6 — GM Debug Panel v1 + Observability APIs ✅ Done

**Purpose**
Make Game Master orchestration visible and testable during Scenario Test Bench sessions.

**Description**
Add lightweight admin/debug APIs and a console GM Debug Panel showing triggers, transitions, unlocks, notes, and session orchestration state after each turn.

**Hypothesis**
Visible orchestration behavior dramatically improves debugging speed, scenario tuning, and trust in the Director–Actor architecture.

**Includes**

- GM Debug panel in Scenario Test Bench
- before/after turn state refresh
- active avatar display
- unlocked avatars display
- GM notes display
- transition history display
- recent GM events display
- `GET /v1/admin/sessions/{sessionId}/inspect`
- `GET /v1/admin/sessions/{sessionId}/events`
- admin-safe event filtering
- no sensitive prompt/credential leakage

**DoD**

- tester can understand what the GM did after each turn
- avatar switches are explainable
- unlock logic is inspectable
- GM events are queryable through API
- debugging no longer requires DB access or raw logs

**What Can Be Tested**

1. send user message → GM event appears after the post-turn GM run
2. GM failure path logs `gm_error` without breaking message sending
3. avatar transition displays reason + timestamp
4. unlocked specialist avatar appears after qualifying turn
5. inspect endpoint returns session + GM state summary
6. events endpoint ordered newest first
7. GM panel updates after every interaction

**User Increment**

- first operational cockpit for observing and tuning guided multi-avatar conversations

---

## EPIC 2.7 — Runtime Inspector & Console v2 ✅ Done

**Purpose**
Make orchestration, memory, and runtime behavior inspectable as the system complexity grows.

**Description**
Extend the console from a simple admin/testing UI into a runtime inspection and debugging tool for sessions, memory, GM behavior, runtime events, and avatar transitions.

The platform now includes:

- async GM orchestration
- layered memory
- runtime SSE events
- avatar switching
- unlock progression
- user persona injection

Operators and developers need visibility into the runtime state to debug and validate system behavior without relying on raw logs or direct database access.

**Hypothesis**
A dedicated runtime inspector significantly improves debugging speed, orchestration quality, and operational confidence.

**Includes**

- session runtime inspector
- runtime-state visualization
- live SSE event stream viewer
- user persona inspector/editor
- layered memory inspector:
  - short-term memory
  - working memory
  - long-term facts

- GM decision inspector
- avatar transition visualization
- unlock progression visualization
- assembled context inspection
- runtime metrics display
- operational debug actions:
  - reset session
  - replay GM
  - clear memory
  - trigger memory refresh

**DoD**

- operator can inspect complete runtime session state
- operator can inspect memory layers independently
- GM decisions and transitions are explainable
- runtime events are visible live from the console
- avatar transitions and unlocks are understandable
- debugging no longer requires DB inspection
- operational actions work safely from the console

**What Can Be Tested**

1. send messages and inspect runtime state changes
2. observe live runtime SSE events
3. inspect memory updates after conversation closure
4. inspect GM decisions and avatar transitions
5. inspect assembled Avatar and GM context
6. reset session and verify cleanup behavior
7. replay GM and inspect updated runtime state

**User Increment**

- first fully inspectable orchestration runtime
- developers and operators can understand system behavior without reading raw logs

---

## EPIC 2.8 — Console debugging redesign ✅ Done

**Purpose**
Consolidate debugging into one coherent operator shell and remove accumulated console drift.

**Description**
Finalize the console redesign with a single debugging shell and bounded, high-signal debug workspaces:

- `Session Setup` with persona-first pre-session flow
- `Memory` evolution/delta workspace
- `GM Impact` causality trace
- `Turn Profiler` latency composition and filters
- `Persona` editor

Deprecated split debug paths and duplicate legacy UI branches were removed.

**DoD**

- one primary debug path from scenario selection
- persona setup is part of the mandatory start flow
- memory/GM/turn debugging are bounded and contract-driven
- stale duplicate console debug routes/components are removed
- lint/typecheck/tests pass for redesigned flow

**User Increment**

- faster, clearer debugging workflow with explicit causality and performance signals

---

# Sprint 4 — Orchestration Intelligence

---

## EPIC 4.1 — Async Game Master v1 ✅ Done

**Purpose**  
Validate the Director–Actor model.

**Description**  
Implement a Game Master observing conversations and injecting directives asynchronously instead of blocking every turn, with a clear split between reasoning and deterministic policy checks.

**Hypothesis**  
Async orchestration improves quality without unacceptable latency cost.

**Includes**

- GM triggers
- structured GM outputs
- instruction injection
- state observation hooks
- policy-aware transition decisions (goals, pacing, constraints)
- active-avatar routing updates

**DoD**

- GM can influence next turns
- response latency remains acceptable

**What Can Be Tested**

- multi-turn conversation
- verify next response changes after trigger
- inspect GM state/directives
- compare latency with and without GM
- verify deterministic policy behavior with fixed inputs
- verify active avatar stays consistent after GM routing decisions

**User Increment**

- smarter guided conversations with low latency

---

## EPIC 4.4 — Multi-Avatar Navigation v1 ✅ Done

**Purpose**  
Make avatar switching explicit, coherent, and reusable across scenarios.

**Description**  
Add generic avatar routing and transition rules so users can move across avatars through progression, topic triggers, or explicit choice.

**Hypothesis**  
Structured multi-avatar navigation increases immersion and learning value more than single-avatar loops.

**Includes**

- active avatar tracking in session state
- available avatar list by scenario/session
- transition rule evaluation (topic/progression/manual)
- transition reason and history capture
- handoff context notes between avatars

**DoD**

- avatar transitions happen deterministically when rules match
- operators can inspect why a transition happened
- no hardcoded scenario-specific transition logic in core

**What Can Be Tested**

1. transition fires from avatar A to B on progression trigger
2. manual avatar switch updates session state correctly
3. transition history records reason + timestamp
4. invalid transition request returns contract error

**User Increment**

- users experience coherent multi-avatar journeys instead of isolated chat turns

---

## EPIC 4.2 — Memory Layer v1 ✅ Done

**Purpose**  
Provide continuity within and across sessions.

**Description**  
Implement session memory summaries and persistent user facts.

**Hypothesis**  
Simple structured memory is enough for MVP usefulness.

**Includes**

- session summary
- user fact extraction
- persistence layer
- retrieval hooks

**DoD**

- avatar recalls recent context
- key user facts persist across sessions

**What Can Be Tested**

- long conversation memory recall
- restart session and reuse facts
- verify summaries update

**User Increment**

- conversations start remembering useful things

---

---

## EPIC 4.2b — Memory System v2 (Pyramidal Memory) ✅ Done

**Purpose**
Transform memory into a structured, multi-layer system.

**Description**

Replace flat memory with:

1. **Short-term memory**
   - last 2 exchanges only

2. **Working memory**
   - evolving session summary

3. **Long-term memory**
   - structured facts, events, relationships

Memory is:

- compacted continuously
- updated asynchronously (aligned with GM)

**Hypothesis**
Hierarchical memory reduces hallucinations and improves continuity.

**Includes**

- memory layer definitions
- compaction pipeline
- storage schema evolution
- retrieval per layer

**DoD**

- long conversations remain coherent without full history
- memory stays bounded
- memory layers are testable independently

**What Can Be Tested**

- 30+ turn conversation remains coherent
- irrelevant history is dropped
- key facts persist correctly

**User Increment**

- system “remembers like a human”

---

## EPIC 4.2c — Memory System v3 (Working + Episodic Memory) ✅ Done

**Purpose**
Implement the actual target memory behavior defined in `MEMORY_SYSTEM_SPEC.md`.

**Description**
The current implementation does not correctly implement the intended memory model.

Working memory, episodic memory, hydration, and continuity behavior are incomplete and do not yet produce the expected conversational continuity.

This EPIC rewrites the memory system around the architecture defined in `MEMORY_SYSTEM_SPEC.md`.

The goal is to implement:

- bounded short-term memory
- rewritten conversation working memory
- durable episodic memory
- conversation hydration
- GM memory access and observability

This EPIC replaces the current partial memory implementation.

**Hypothesis**
Conversation continuity requires structured bounded memory evolution, not transcript replay and not isolated summaries/facts.

**Includes**

- bounded short-term memory assembly
- rewritten conversation working memory lifecycle
- periodic working memory refresh
- conversation-close episodic memory generation
- `conversation_memories` persistence
- episodic memory retrieval
- hydration at conversation creation
- episodic-memory-based fact extraction
- GM episodic memory access
- memory selection observability
- hydration observability
- memory debugging tooling
- removal of obsolete/conflicting memory logic

**DoD**

- short-term memory remains bounded
- working memory is continuously rewritten
- long conversations work without transcript replay
- closed conversations generate episodic memories
- new conversations hydrate from previous memories
- avatars remember previous interactions naturally
- GM can use episodic memories
- memory selection becomes observable
- memory refresh failures remain isolated
- implementation aligns with `MEMORY_SYSTEM_SPEC.md`

**What Can Be Tested**

1. inspect short-term memory bounds
2. verify periodic working memory refresh
3. verify bounded memory after long conversations
4. close conversation → episodic memory created
5. start new conversation → hydration occurs
6. verify avatar continuity across conversations
7. verify GM episodic memory usage
8. inspect hydration and memory selection reasoning
9. simulate memory refresh failures

**User Increment**

- avatars remember previous discussions coherently
- long discussions remain bounded and understandable
- conversations feel continuous across sessions
- GM orchestration becomes memory-aware
- operators can inspect and debug memory behavior reliably

**Progress update (May 8, 2026)**

- EPIC 4.2c is complete.
- Implemented slices:
  - contract cleanup and canonical ownership
  - conversation working-memory lifecycle + trigger policy
  - episodic memory persistence (`conversation_memories`) + close-generation + start hydration baseline
  - GM episodic-memory consumption + deterministic selection policy
  - memory selection and hydration observability/debug surfaces
  - hardening/test-closure/doc-sync gates

---

## EPIC 4.1b — Game Master Context Awareness Upgrade

**Purpose**
Enable GM to reason using memory and world context, not only recent messages.

**Description**

Extend GM input to include:

- memory summaries
- world context (scenario RAG)
- avatar knowledge context

GM now:

- navigates memory layers
- triggers context injection (not only routing)

**Hypothesis**
Better context → better orchestration decisions.

**Includes**

- updated GM input contract
- memory + RAG injection into GM reasoning
- context-aware unlock decisions

**DoD**

- GM decisions reflect past events
- avatar routing improves with context

**What Can Be Tested**

- GM suggests different avatars based on past interactions
- GM avoids repeating topics already covered

**User Increment**

- smarter, less repetitive guidance

---

## EPIC 4.3 — Performance Baseline ✅ Done

**Purpose**  
Measure real interaction costs.

**Description**  
Instrument latency, TTFT, token usage, and compare Avatar-only vs Avatar+GM flows.

**Hypothesis**  
The async model remains viable in real conditions.

**Includes**

- TTFT metrics
- step timing
- provider comparison baseline

**DoD**

- measurable performance baseline exists

**What Can Be Tested**

- benchmark known flows
- compare providers
- compare architecture modes

**User Increment**

- objective data for product decisions

---

## EPIC 4.5 — Player Runtime State & World Events ✅ Done

**Purpose**  
Let clients know when the world/session state has changed after an async GM run.

**Description**  
Add a player-facing runtime-state model and SSE event stream so clients can react to async world changes without relying on implicit polling or waiting for the next user turn.

**Includes**

- SSE runtime stream endpoint: `GET /v1/sessions/{sessionId}/events/stream`
- `GET /v1/sessions/{sessionId}/runtime-state`
- explicit runtime status model (`canSendMessage`, `isProcessing`, optional pending event)
- runtime events emitted from async GM/system decisions (unlocks, suggestions, choice required, processing lifecycle)
- session-scoped event publication (no event leakage across sessions)

**DoD**

- client can react to async world changes in realtime via SSE
- client can retrieve a consistent runtime-state snapshot at any time
- GM remains async and non-blocking while its decisions become observable to clients
- no WebSocket dependency in Phase A (SSE only)
- no heavy event sourcing/event-store redesign introduced
- async GM remains non-blocking by default

---

# Sprint 3 — Operability + Control

---

## EPIC 3.1 — Operational Health & Dependency Monitoring ✅ Done

**Purpose**  
Know if the platform is working before users report issues.

**Description**  
Expose health and dependency probes for Postgres, Redis, and LLM providers.

**Hypothesis**  
Early monitoring reduces downtime and blind debugging.

**Includes**

- `/health`
- `/admin/dependencies`
- latency probes
- structured health logs

**DoD**

- operator can detect degraded dependencies immediately

**What Can Be Tested**

- stop DB → degraded state
- stop Redis → degraded state
- wrong provider key → provider error visible

**User Increment**

- operators can trust platform runtime state

---

## EPIC 3.2 — Session Inspector v1 ✅ Done

**Purpose**  
Allow operators to inspect live behavior safely.

**Description**  
Create admin endpoints/UI to inspect sessions, messages, memory, and recent events.

**Hypothesis**  
Real production visibility finds bugs faster than assumptions.

**Includes**

- session list
- session detail
- messages view
- memory snapshot
- recent errors

**DoD**

- operator can diagnose one session without DB access

**What Can Be Tested**

- run a session
- inspect stored messages
- compare expected vs actual state

**User Increment**

- first debugging cockpit for conversations

---

## EPIC 3.3 — Replay & Recovery Tools

**Purpose**  
Enable safe experimentation and faster debugging.

**Description**  
Provide reset, replay-last-turn, and audit logging for operational actions.

**Hypothesis**  
Fast recovery loops improve iteration speed dramatically.

**Includes**

- replay last turn
- reset runtime state
- admin action audit log
- action permissions groundwork

**DoD**

- operator can retry and recover sessions safely

**What Can Be Tested**

- force bad conversation
- replay turn
- reset broken session
- verify audit trail

**User Increment**

- safe recovery tools without engineering intervention

---

# Sprint 5 — Knowledge + Context Intelligence

---

## EPIC 5.1 — Multi-Layer Knowledge & RAG System v1

**Purpose**
Enable the system to use structured knowledge across different domains in a consistent and scalable way.

**Description**
Build a unified knowledge pipeline that supports **multiple types of retrieval (RAG)** instead of a single generic knowledge store.

The system must support three distinct knowledge domains:

1. **Avatar Memory RAG**
   - personal history
   - past interactions
   - long-term memory outputs

2. **World / Scenario RAG**
   - environment descriptions
   - rules, lore, objectives
   - contextual elements of the experience

3. **Media RAG (image/video)**
   - visual or external references
   - illustrative content linked to context

All knowledge types share a **common ingestion pipeline**, but:

- are differentiated by `type` and metadata
- may use different retrieval strategies
- are merged later by the Context Engine

**Hypothesis**
Structured knowledge retrieval improves relevance, reduces noise, and enables richer interactions compared to a flat knowledge system.

**Includes**

- source upload (PDF, markdown, text, media)
- chunking and preprocessing
- embeddings and pgvector storage
- knowledge source typing (`memory`, `world`, `media`)
- retrieval pipelines per type
- metadata for traceability

**DoD**

- ingested knowledge influences responses
- retrieval respects knowledge type (memory vs world vs media)
- sources are traceable and inspectable
- system avoids mixing unrelated knowledge domains

**What Can Be Tested**

1. upload different source types (text, world, media)
2. query each type independently
3. verify correct retrieval based on context
4. verify irrelevant sources are not retrieved

**User Increment**

- richer, more grounded, and context-aware responses

---

## EPIC 5.2 — Context Engine v2 (Core Orchestrator)

**Purpose**
Make context assembly the central intelligence of the system.

**Description**
Build a deterministic **Context Engine** responsible for assembling all relevant information into a bounded runtime context for the Avatar and Game Master.

The Context Engine combines:

- **short-term memory**
  - last exchanges only

- **working memory**
  - session summary

- **long-term memory**
  - structured persistent memory

- **RAG outputs**
  - avatar memory
  - world/scenario knowledge
  - media references

- **scenario context**
  - goals, rules, environment

- **Game Master directives**
  - guidance and orchestration signals

- **user persona**
  - role and tone influencing interaction

The engine is responsible for:

- selecting relevant information
- prioritizing context sources
- resolving conflicts between sources
- enforcing token budget constraints

Aligned with principle:
👉 Context is the product

**Hypothesis**
Context quality has a greater impact on system behavior than model choice.

**Includes**

- context assembly pipeline
- priority and precedence rules
- token budget management
- context trimming strategies
- deterministic merging logic
- observability of final context payload

**DoD**

- context is explainable and testable
- each context component is independently verifiable
- system remains stable under long conversations
- removing a context layer has a predictable impact

**What Can Be Tested**

1. inspect final context payload per turn
2. verify correct prioritization (memory vs RAG vs scenario)
3. test long conversations without degradation
4. verify irrelevant context is excluded
5. validate token budget enforcement

**User Increment**

- more coherent, stable, and controllable conversations

---

## EPIC 5.3 — Streaming UX Layer

**Purpose**  
Improve perceived responsiveness.

**Description**  
Implement SSE or WebSocket streaming for Avatar responses.

**Hypothesis**  
Streaming matters more than raw completion speed.

**Includes**

- token streaming
- streaming transport
- progressive UI rendering

**DoD**

- user sees progressive response generation

**What Can Be Tested**

- response starts quickly
- tokens stream in order
- interruptions handled cleanly

**User Increment**

- faster-feeling live conversations

---

## EPIC 5.4 — Guided Progression Engine v1

**Purpose**  
Ensure conversations move toward scenario objectives instead of drifting into generic chat.

**Description**  
Implement configurable progression logic that combines goals, pacing rules, and role fidelity constraints with GM orchestration.

**Hypothesis**  
Explicit progression rules produce better educational and narrative outcomes than free-form generation alone.

**Includes**

- scenario goals model integration
- pacing rule evaluation
- progression milestone tracking
- recommended user choices generation
- guardrails for role fidelity and objective coverage

**DoD**

- progression state is visible and testable
- stalling conversations trigger appropriate guidance
- role breaks are reduced in guided scenarios

**What Can Be Tested**

1. progression increases when objective criteria are met
2. pacing rule triggers guidance after stalled turns
3. recommended choices align with current objective
4. role-fidelity constraints block invalid guidance paths

**User Increment**

- sessions feel directed, meaningful, and outcome-oriented

---

## EPIC 5.5 — User Persona System ✅ Done

**Purpose**
Allow users to define their role in the experience.

**Description**

Extend User model with:

- role (friend, psychologist, etc.)
- tone preference
- optional interaction style

Persona is injected into:

- avatar prompts
- GM reasoning

**Hypothesis**
User-defined identity increases immersion and relevance.

**Includes**

- user persona schema (JSONB)
- API to define/update persona
- context integration

**DoD**

- persona influences avatar responses
- persona persists across sessions

**What Can Be Tested**

- same scenario, different persona → different experience

**User Increment**

- user becomes part of the system, not just an input source

---

## EPIC 5.6 — Hybrid Response System v2 (Cache + AI)

**Purpose**
Improve latency and consistency.

**Description**

Introduce:

- pre-generated Q/A cache
- retrieval-first response strategy
- fallback to LLM

Optional future:

- SLM fine-tuning (not blocking)

**Hypothesis**
Hybrid systems outperform pure LLM systems.

**Includes**

- cache layer
- response selection logic
- fallback strategy

**DoD**

- common queries are faster
- fallback works reliably

**What Can Be Tested**

- known queries hit cache
- unknown queries fallback to LLM

**User Increment**

- faster and more reliable responses

# Sprint 6 — Back-office + Real Scenario

---

## EPIC 6.1 — Scenario Builder v1

**Purpose**  
Enable non-developers to configure experiences.

**Description**  
Provide a simple web panel to create/edit scenarios, avatars, objectives, and sources.

**Hypothesis**  
Back-office usability is enough for MVP; no consumer frontend required yet.

**Includes**

- scenario editor
- avatar editor
- goals/pacing editor
- transition rule editor
- reusable variable editor
- source upload
- save/load config

**DoD**

- non-developer can configure a scenario

**What Can Be Tested**

- create full scenario without code
- edit avatar live
- upload sources

**User Increment**

- content team autonomy begins

---

## EPIC 6.2 — AVA Scenario Validation

**Purpose**  
Test the platform on real content.

**Description**  
Use AVA assets, characters, and narrative material to validate product quality.

**Hypothesis**  
Real scenarios expose issues synthetic tests miss.

**Includes**

- AVA scenario config
- persona materials
- narrative tests
- operator review sessions

**DoD**

- AVA scenario runs with usable quality

**What Can Be Tested**

- real end-user sessions
- narrative consistency
- immersion quality

**User Increment**

- first market-relevant scenario

---

## EPIC 6.3 — Summer Prototype Delivery

**Purpose**  
Deliver the agreed MVP Scenario A.

**Description**  
A text-in/text-out conversational core with usable back-office and one validated scenario.

**Hypothesis**  
Scenario A is the right scope for summer success.

**Includes**

- back-office
- AVA scenario
- API
- core engine
- documentation

**DoD**

- working prototype demoable to external stakeholders

**What Can Be Tested**

- full demo flow
- stakeholder walkthrough
- operator-managed scenario lifecycle

**User Increment**

- first external prototype ready

---

## EPIC 6.4 — Hybrid Response Optimization v1

**Purpose**  
Improve response consistency and latency while preserving generative flexibility.

**Description**  
Introduce a hybrid response path combining canonical answers, retrieval-backed answers, constrained generation, and live generation fallback.

**Hypothesis**  
A hybrid response engine improves quality/cost/latency trade-offs versus pure live generation.

**Includes**

- canonical response lookup for recurring intents
- retrieval-grounded response path
- constrained generation templates for high-risk outputs
- fallback path to live generation when no deterministic match exists
- response-path observability tags

**DoD**

- response path is explicit per turn
- fallback behavior is safe and measurable
- no regression in baseline conversational quality

**What Can Be Tested**

1. known intent returns canonical response path
2. retrieval path used when source confidence threshold is met
3. constrained generation path validates required structure
4. fallback path activates when other paths are not eligible

**User Increment**

- faster, more reliable responses without losing adaptability

# Final Rule

If an EPIC does not leave the system more usable, more testable, more operable, or more valuable, it should probably be split or reordered.

## Recommended implementation order

### 7. EPIC 5.1 — Multi-Layer Knowledge & RAG System v1

Now build RAG, because memory and world/media retrieval need a retrieval infrastructure.

### 8. EPIC 5.2 — Context Engine v2

This should come **after persona + memory + RAG**, because its job is to assemble them. It becomes the integration layer.

### 9. EPIC 2.1b — Avatar Agent v2

Once the Context Engine exists, upgrade avatars to consume persona, memory, and RAG-aware context. Otherwise you risk hardcoding context injection into avatar prompts.

### 10. EPIC 4.1b — Game Master Context Awareness Upgrade

After Context Engine + Avatar v2, upgrade the GM to use the same memory/RAG/persona context.

### 11. EPIC 5.4 — Guided Progression Engine v1

Do this after GM context awareness, because progression depends on better memory, context, and scenario state.

### 13. EPIC 3.3 — Replay & Recovery Tools

Replay is more useful once the context/memory pipeline exists, because you’ll need to debug complex turns.

### 14. EPIC 5.3 — Streaming UX Layer

Do this after the core intelligence loop is stable. Streaming improves UX but does not fix reasoning quality.

### 15. EPIC 6.1 — Scenario Builder v1

Only build richer authoring once the underlying concepts are stable: persona, memory, RAG, context, progression.

### 16. EPIC 6.2 — AVA Scenario Validation

Use the real scenario once the core is coherent enough to expose meaningful issues.

### 17. EPIC 5.6 / 6.4 — Hybrid Response System / Optimization

These two overlap strongly. I would merge them later and implement only after you have real usage patterns.

### 18. EPIC 6.3 — Summer Prototype Delivery

Final packaging/demo milestone.
