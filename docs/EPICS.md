# EPICS.md

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

## EPIC 1.1 — Core Platform Bootstrap

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

---

## EPIC 1.2 — First LLM Loop + Observability

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

---

## EPIC 2.2 — Session Lifecycle v1

**Purpose**  
Make the platform continuously usable through real conversations.

**Description**  
Implement the core session lifecycle: start session, persist messages, read history, reset session.

**Hypothesis**  
Usable sessions create faster learning than isolated raw exchanges.

**Includes**

- start session endpoint
- message persistence
- conversation history endpoint
- reset session endpoint
- session status management

**DoD**

- user can create a session and converse across turns
- history is preserved and readable
- session can be reset safely

---

## EPIC 2.3 — Manual Test Console v1

**Purpose**  
Allow rapid testing by developers and non-developers.

**Description**  
Create a lightweight back-office UI to create sessions, send messages, inspect history, and reset sessions.

**Hypothesis**  
A visible manual testing loop accelerates quality more than backend-only progress.

**Includes**

- simple chat UI
- create session flow
- history viewer
- reset button
- basic debug metadata display

**DoD**

- non-developer can test the platform end-to-end without code

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

---

## EPIC 3.2 — Session Inspector v1

**Purpose**  
Allow operators to inspect live behavior safely.

**Description**  
Create admin endpoints to inspect sessions, messages, memory, and recent events.

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

- chunking
- embeddings
- pgvector storage
- retrieval pipeline

**DoD**

- ingested knowledge can influence answers

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

---

# Phase B — Enhanced Core (High Level)

Future EPIC groups:

- voice pipeline
- multimedia triggers
- multi-avatar sessions
- scenario graphs
- consumer frontend
- load testing

---

# Phase C — Pre-Research Handoff (High Level)

Future EPIC groups:

- security / multi-tenant
- scaling architecture
- SDK / integrations
- freeze / handoff package

---

# Final Rule

If an EPIC does not leave the system more usable, more testable, more operable, or more valuable, it should probably be split or reordered.
