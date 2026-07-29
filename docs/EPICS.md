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

As of July 21, 2026, the Phase A core runtime is delivered through EPIC 8.4. The backlog below remains open only where explicitly marked.

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

### Orchestration, Memory, And Runtime State

#### `4.1 Async Game Master v1` ✅ Done

Implemented non-blocking Game Master execution with structured decisions, routing influence, and deterministic runtime safeguards.

#### `4.1c Multi-Model Runtime Configuration` ✅ Done

Added deterministic model selection across global, role, scenario, and avatar scopes, together with admin editing and observability of effective model usage.

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

Delivered typed knowledge ingestion, chunking, embeddings, retrieval pipelines, and admin diagnostics for memory, world, and media knowledge.

#### `5.1b Avatar-Scoped Knowledge Visibility` ✅ Done

Added avatar-scoped retrieval visibility so avatars only see allowed knowledge while the Game Master keeps unrestricted orchestration access.

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

Delivered the public message-stream client and progressive avatar rendering in `apps/web`. The
single active thread keeps optimistic user sends, renders one in-memory avatar draft while ordered
deltas arrive, reconciles the terminal event with the persisted avatar message, and clears drafts on
errors or interruptions. The shipped path is hardened by regression coverage for contiguous delta
ordering, completion and interruption cleanup, exact-once avatar persistence, provider iterator and
web reader cleanup, and backward-compatible JSON send-message responses. Documentation now records
the stream as additive transport behavior: interruptions never persist partial avatar content or
trigger post-turn Game Master/memory work.

### Phase A Refinements

#### `8.1 Avatar Trait Structuring` ✅ Done

Introduced explicit scenario-scoped avatar-trait preparation so runtime prompt assembly can consume canonical computed traits instead of ad hoc fields.

#### `8.2 Runtime Context Assembly Refactoring` ✅ Done

Refactored runtime context into structured sections with clearer precedence and tighter prompt assembly for Avatar behavior.

#### `8.3 Game Master Prompt Refinement` ✅ Done

Strengthened the Game Master prompt contract with explicit structure and clearer decision-policy guidance.

#### `8.4 Working Memory Prompt Refinement` ✅ Done

Refined working-memory generation around structured fields such as `coveredTopics` and aligned the related operator-facing inspection surfaces.

### `8.5 Game Master Post-Analysis Refinement` ✅ Done

**Current state**
The asynchronous Game Master provides structured orchestration decisions after each Avatar response.
Its output is focused on next-turn orchestration, with memory compaction and application state kept
under their owning boundaries.

**Purpose**
Improve the quality, maintainability, and usefulness of asynchronous Game Master orchestration without changing the existing runtime architecture or introducing additional latency.

**Description**
Refine the Game Master so it focuses exclusively on preparing the next Avatar turn. Introduce first-class retrieval planning, explicit dialogue-control modes, simplified routing decisions, and clearer ownership boundaries between Game Master orchestration, application logic, and working-memory compaction.

The Game Master remains a single asynchronous post-analysis step executed after the Avatar response. Its output is stored and consumed during the next Avatar turn, allowing richer orchestration without delaying the current interaction.

**Includes**

- explicit dialogue-control modes (`user_led`, `avatar_guided`, `avatar_led`, `repair`, `transition`)
- first-class retrieval planning for the next Avatar turn
- simplified and normalized Avatar routing contract
- dynamic routing capabilities based on runtime scenario configuration
- removal of application-owned fields from the GM output
- clarification of ownership between Game Master and working-memory compaction
- improved integration of stored GM guidance into the Avatar runtime
- required non-empty Director Notes as the canonical GM narrative guidance field
- platform-owned conversation handoff after GM records a switch target

**Definition of done**

- the Game Master remains a single asynchronous post-analysis call
- current Avatar responses are not delayed by Game Master execution
- retrieval planning is generated and consumed during the next relevant Avatar turn
- dialogue-control modes influence Avatar behaviour consistently
- routing continues to support Avatar suggestion, switching, and unlocking
- routing capabilities adapt dynamically to the current scenario configuration
- application-owned state is removed from the Game Master contract
- working-memory ownership remains exclusively within the memory-compaction pipeline
- existing multi-Avatar behaviour and progression logic remain compatible

**What can be tested**

1. contradictions generate appropriate retrieval plans and repair dialogue mode
2. stored retrieval planning is consumed during the next related Avatar turn
3. unrelated user messages do not reuse stale retrieval plans
4. dialogue-control modes produce the expected Avatar behaviour
5. single-Avatar scenarios omit unnecessary routing instructions
6. multi-Avatar scenarios continue to support switching and unlocking
7. contradicted Avatar statements are not persisted as working-memory facts
8. asynchronous execution remains non-blocking
9. current persisted retrieval scopes and multi-target unlock decisions survive reload
10. post-LLM persistence failures emit structured GM diagnostics

**User increment**

- more consistent, context-aware Avatar conversations with improved factual grounding, clearer dialogue flow, and better orchestration, while preserving the existing low-latency conversation experience.

## Open Backlog

### `3.3 Replay & Recovery Tools`

**Current state**  
Partially covered by GM replay, memory refresh/clear, and runtime inspection actions, but not closed as a dedicated milestone.

**Purpose**  
Enable safe experimentation and faster debugging.

**Description**  
Provide reset, replay-last-turn, and audit logging for operational recovery actions so operators can recover broken sessions without engineering intervention.

**Includes**

- replay last turn
- reset runtime state
- admin action audit log
- action permissions groundwork

**Definition of done**

- operators can retry and recover sessions safely
- recovery actions are explicit and traceable
- sensitive actions have clear permission boundaries

**What can be tested**

1. force a broken conversation state
2. replay the last turn
3. reset the affected runtime state
4. verify the audit trail records each operator action

**User increment**

- safe recovery tools without direct engineering support

### `5.4 Guided Progression Engine v1`

**Current state**  
No standalone progression engine exists beyond current GM heuristics and scenario-goal handling.

**Purpose**  
Ensure conversations move toward scenario objectives instead of drifting into generic chat.

**Description**  
Implement configurable progression logic that combines goals, pacing rules, milestone tracking, and role-fidelity constraints with GM orchestration.

**Includes**

- scenario goals model integration
- pacing rule evaluation
- progression milestone tracking
- recommended user choices generation
- guardrails for role fidelity and objective coverage

**Definition of done**

- progression state is visible and testable
- stalled conversations trigger appropriate guidance
- role breaks are reduced in guided scenarios

**What can be tested**

1. progression advances when objective criteria are met
2. pacing rules trigger guidance after stalled turns
3. recommended choices align with the active objective
4. role-fidelity constraints block invalid guidance paths

**User increment**

- sessions feel directed, meaningful, and outcome-oriented

### `5.6 / 6.4 Hybrid Response System / Hybrid Response Optimization`

**Current state**  
Still open. The original `5.6` and `6.4` scopes overlap enough that future implementation should treat them as one EPIC unless requirements diverge materially.

**Purpose**  
Improve latency, consistency, and controllability without removing live generative flexibility.

**Description**  
Introduce a hybrid response path that can choose among canonical answers, retrieval-backed answers, constrained generation, and live generation fallback.

**Includes**

- canonical or cached response lookup for recurring intents
- retrieval-first response path when grounded knowledge is sufficient
- constrained generation templates for high-risk or structured outputs
- fallback to live generation when deterministic paths are not eligible
- response-path observability tags and diagnostics

**Definition of done**

- response path is explicit and measurable on each turn
- common queries are faster when they match deterministic paths
- fallback behavior is safe and reliable
- no regression in baseline conversational quality

**What can be tested**

1. known intents hit the canonical or cached path
2. retrieval path activates when source confidence is sufficient
3. constrained generation returns the required structure
4. live-generation fallback activates when no deterministic path applies

**User increment**

- faster, more reliable responses without losing adaptability

### `6.2 AVA Scenario Validation`

**Current state**  
The milestone is not recorded complete.

**Purpose**  
Test the platform on real content.

**Description**  
Use AVA assets, characters, and narrative material to validate conversation quality, operator workflow, and scenario realism beyond synthetic tests.

**Includes**

- AVA scenario configuration
- persona materials
- narrative test sessions
- operator review sessions

**Definition of done**

- the AVA scenario runs at usable quality
- scenario-specific issues are documented and addressed
- operator workflows are sufficient for maintaining the scenario

**What can be tested**

1. real end-user sessions with AVA content
2. narrative consistency across multiple conversations
3. immersion and operator quality review loops

**User increment**

- first market-relevant validated scenario

### `6.3 Summer Prototype Delivery`

**Current state**  
The delivery milestone is not recorded complete.

**Purpose**  
Deliver the agreed MVP Scenario A.

**Description**  
Package the text-in/text-out core, usable back-office, validated scenario, and supporting documentation into an external-stakeholder-ready prototype.

**Includes**

- back-office tooling
- AVA scenario
- API surface
- core runtime
- supporting documentation

**Definition of done**

- the prototype is demoable to external stakeholders
- scenario lifecycle can be operated without code changes
- the delivery package is documented clearly enough to hand over

**What can be tested**

1. end-to-end demo walkthrough
2. stakeholder-facing prototype review
3. operator-managed scenario lifecycle from setup through conversation

**User increment**

- first external prototype ready for demonstration

### `8.6 Scripted Conversation Response Evaluation`

**Current state**
The contract-cleanup, tool-foundation, and sequential HTTP runner slices are shipped; semantic
judging, aggregation, and report persistence remain.

**Purpose**
Make conversation quality, latency, token usage, and available cost data easy to compare without
building a new product UI or changing the normal conversation flow.

**Description**
Add a TypeScript command-line evaluation tool that loads a versioned JSON conversation definition,
starts a session through the existing API, resolves a deterministic initial-avatar selector, and
sends questions sequentially through one conversation. Each response is evaluated semantically by
an LLM judge through the existing authenticated raw-exchange boundary, then written to a structured
JSON report and summarized in the console. Model comparison is achieved by running the same
definition against separately configured runtime targets; the tool does not invent a per-request
model override. Cost is recorded when the API supplies it and remains explicitly unavailable when
it does not.

**Includes**

- versioned, manually editable JSON test definitions
- scenario and initial-avatar selection using existing API contracts
- sequential single-session execution
- structured semantic judge results with pass/fail, score, explanation, missing elements, and contradictions
- per-question and run-level latency and token metrics
- nullable cost reporting with no local pricing estimation
- partial-result persistence, error classification, and readable console output
- one real seeded-scenario example and deterministic automated tests

**Definition of done**

- a local command can execute at least three ordered questions in one seeded scenario
- every question uses the same session and conversation
- Avatar and judge calls use existing authenticated API boundaries; provider SDKs are not imported by the tool
- model labels/effective models are recorded and mismatches are visible
- semantic judge output is validated and judge failures remain distinct from Avatar quality failures
- JSON reports preserve per-question results and partial runs
- latency and token usage are captured from API responses; cost is either captured or reported as unavailable
- unit and integration-style tool tests cover ordering, paraphrases, missing facts, contradictions, API errors, judge errors, and partial reports
- usage documentation and an example definition are available

**What can be tested**

1. questions are processed in definition order through one conversation
2. the same definition can be rerun against a different configured runtime model
3. a valid paraphrase passes semantic judging
4. missing essential content and contradictions fail judging
5. API errors and judge errors are classified separately from quality failures
6. response latency and token counts match the API payloads
7. unavailable cost is not reported as zero or estimated
8. an interrupted run leaves a valid partial JSON report

**User increment**

- a repeatable baseline for conversation quality and runtime-cost comparisons without a dashboard or CI integration

## Superseded Or Absorbed Items

### `4.1b Game Master Context Awareness Upgrade`

Do not reopen this as a standalone EPIC unless the scope changes materially. Its intended outcome is already covered by shipped work in `5.1`, `5.1b`, `5.2`, `8.3`, and `8.4`.

## Future-Use Rules

- Create a new EPIC only for a coherent, testable product increment.
- Keep implementation history out of this file; detailed execution belongs in commits, PRs, and focused design docs.
- When an EPIC is absorbed by later work, mark it as absorbed instead of duplicating the same scope under multiple headings.
