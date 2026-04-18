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

## EPIC 2.2 — Scenario & Session Lifecycle v1

**Purpose**  
Make the platform continuously usable through real conversations.

**Description**  
Implement minimal admin creation of scenarios/avatars plus session lifecycle: start session, persist messages, read history, reset session.

**Hypothesis**  
Real usable sessions require manageable content objects and persistent conversation state.

**Includes**

- create scenario endpoint
- create avatar endpoint
- start session endpoint
- message persistence
- history endpoint
- reset session endpoint
- session status management

**DoD**

- operator can create scenario + avatar
- user can create a session and converse across turns
- history is preserved
- session can be reset safely

**What Can Be Tested**

1. create scenario
2. create avatar
3. start session
4. send messages
5. reload history
6. reset session

**User Increment**

- first complete end-to-end conversation flow

---

## EPIC 2.3 — Manual Test Console v1

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

# Sprint 3 — Operability + Control

---

## EPIC 3.1 — Operational Health & Dependency Monitoring

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

## EPIC 3.2 — Session Inspector v1

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

# Sprint 4 — Orchestration Intelligence

---

## EPIC 4.1 — Async Game Master v1

**Purpose**  
Validate the Director–Actor model.

**Description**  
Implement a Game Master observing conversations and injecting directives asynchronously instead of blocking every turn.

**Hypothesis**  
Async orchestration improves quality without unacceptable latency cost.

**Includes**

- GM triggers
- structured GM outputs
- instruction injection
- state observation hooks

**DoD**

- GM can influence next turns
- response latency remains acceptable

**What Can Be Tested**

- multi-turn conversation
- verify next response changes after trigger
- inspect GM state/directives
- compare latency with and without GM

**User Increment**

- smarter guided conversations with low latency

---

## EPIC 4.2 — Memory Layer v1

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

## EPIC 4.3 — Performance Baseline

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

# Sprint 5 — Knowledge + Context Intelligence

---

## EPIC 5.1 — Knowledge Pipeline v1

**Purpose**  
Allow the system to use external content.

**Description**  
Build ingestion + retrieval for PDF, markdown, and text sources.

**Hypothesis**  
Relevant retrieval improves quality more than larger prompts alone.

**Includes**

- source upload
- chunking
- embeddings
- pgvector storage
- retrieval pipeline

**DoD**

- ingested knowledge can influence answers

**What Can Be Tested**

1. upload source
2. wait ready
3. ask source question
4. verify grounded answer

**User Increment**

- first knowledge-powered scenarios

---

## EPIC 5.2 — Context Manager v1

**Purpose**  
Unify all context dimensions.

**Description**  
Assemble memory, scenario world, retrieved knowledge, and GM directives into bounded runtime context.

**Hypothesis**  
Explicit context composition improves coherence and control.

**Includes**

- memory injection
- scenario context
- retrieval merge logic
- token budget rules

**DoD**

- context sources are traceable
- prompts remain bounded

**What Can Be Tested**

- long realistic scenario sessions
- verify right facts used
- verify irrelevant noise excluded

**User Increment**

- more coherent and controllable responses

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

# Final Rule

If an EPIC does not leave the system more usable, more testable, more operable, or more valuable, it should probably be split or reordered.
