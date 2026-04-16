# EPICS.md

## Purpose

This document defines the **EPICs for the MVP roadmap**.

Each EPIC:

* groups several related checklist items into one meaningful delivery block
* fits within **one sprint** when possible
* delivers a **testable increment**
* validates a **key hypothesis or risk**
* remains understandable in isolation

## EPIC Granularity Rule

We do **not** create one EPIC per checkbox.

Checkboxes are execution tasks.  
EPICs are coherent value blocks.

This avoids fragmentation, excessive management overhead, and false progress signals.  
Granularity can be refined later if some EPICs become too large or unclear. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}

---

# Phase A — Minimal Core (April → July 2026)

## Goal

Build and validate a **Core Engine (text-in → orchestration → text-out)** that:

* produces coherent conversations
* manages context efficiently
* remains performant
* is measurable
* is usable through a back-office
* is ready for a summer prototype

---

# Sprint 1 — Foundations

---

## EPIC 1.1 — Core Platform Bootstrap

**Purpose**  
Create the technical foundation for all future work.

**Description**  
Set up the monorepo, local runtime environment, Docker stack, modular monolith structure, and developer workflow.

**Hypothesis**  
A clean local-first foundation increases delivery speed and reduces future rework.

**Includes**

* GitHub repo
* pnpm / turborepo monorepo
* Docker local stack
* app + PostgreSQL + pgvector + Redis
* base module structure
* developer scripts

**DoD**

* full stack runs locally
* new developer can start in reasonable time
* project structure is clear

---

## EPIC 1.2 — First LLM Loop + Observability

**Purpose**  
Validate end-to-end AI interaction immediately.

**Description**  
Implement the first wrapper-based LLM call and capture metrics from day one.

**Hypothesis**  
Observability early prevents blind architecture decisions later.

**Includes**

* LLM wrapper
* first text-in / text-out exchange
* logging wrapper
* latency / token / cost tracking
* basic metrics visibility

**DoD**

* user message returns model response
* metrics captured for every call
* wrappers isolate providers/tools

---

# Sprint 2 — Avatar + Game Master Async

---

## EPIC 2.1 — Avatar Agent v1

**Purpose**  
Create the first believable conversational entity.

**Description**  
Build an Avatar that answers directly with personality, memory hooks, and in-character behavior.

**Hypothesis**  
A differentiated avatar creates more value than generic chatbot behavior.

**Includes**

* persona prompt structure
* tone/personality controls
* direct reply flow
* session identity continuity

**DoD**

* avatar sustains coherent multi-turn exchange
* avatar feels distinct

---

## EPIC 2.2 — Async Game Master v1

**Purpose**  
Validate the Director–Actor model.

**Description**  
Implement a Game Master observing conversations and injecting directives asynchronously instead of blocking every turn.

**Hypothesis**  
Async orchestration improves quality without unacceptable latency cost.

**Includes**

* GM triggers
* structured GM outputs
* instruction injection
* state observation hooks

**DoD**

* GM can influence next turns
* response latency remains acceptable

---

## EPIC 2.3 — Performance Baseline

**Purpose**  
Measure real interaction costs.

**Description**  
Instrument latency, TTFT, token usage, and compare Avatar-only vs Avatar+GM flows.

**Hypothesis**  
The async model remains viable in real conditions.

**Includes**

* TTFT metrics
* step timing
* provider comparison baseline

**DoD**

* measurable performance baseline exists

---

# Sprint 3 — Memory + API Gateway

---

## EPIC 3.1 — Memory Layer v1

**Purpose**  
Provide continuity within and across sessions.

**Description**  
Implement two-layer memory: session memory + persistent user facts.

**Hypothesis**  
Simple structured memory is enough for MVP usefulness.

**Includes**

* sliding window
* cumulative summary
* user fact extraction
* PostgreSQL persistence

**DoD**

* avatar recalls recent conversation
* key user facts persist across sessions

---

## EPIC 3.2 — Public Core API

**Purpose**  
Expose the engine as a reusable platform.

**Description**  
Create REST endpoints for sessions and messages with basic authentication.

**Hypothesis**  
API-first design accelerates all future UI and integration work.

**Includes**

* /conversation/start
* /conversation/message
* /conversation/history
* API key auth
* OpenAPI docs

**DoD**

* documented API usable externally

---

## EPIC 3.3 — Streaming UX Layer

**Purpose**  
Improve perceived responsiveness.

**Description**  
Implement WebSocket streaming for Avatar responses.

**Hypothesis**  
Streaming matters more than raw completion time.

**Includes**

* token streaming
* websocket connection flow

**DoD**

* user sees progressive response generation

---

# Sprint 4 — RAG + Context Intelligence

---

## EPIC 4.1 — Knowledge Pipeline v1

**Purpose**  
Allow the system to use external content.

**Description**  
Build ingestion + retrieval for PDF, markdown, and text sources.

**Hypothesis**  
Relevant retrieval improves quality more than larger prompts alone.

**Includes**

* chunking
* embeddings
* pgvector storage
* retrieval pipeline

**DoD**

* ingested content can influence answers

---

## EPIC 4.2 — Context Manager v1

**Purpose**  
Unify all context dimensions.

**Description**  
Assemble memory + scenario world + retrieved knowledge into structured runtime context.

**Hypothesis**  
Explicit context composition improves coherence and control.

**Includes**

* memory injection
* scenario config context
* RAG merge logic
* token budget rules

**DoD**

* context sources are traceable
* prompt remains bounded

---

## EPIC 4.3 — AVA Content Validation

**Purpose**  
Test the architecture on real content.

**Description**  
Use AVA assets, character data, and narrative materials.

**Hypothesis**  
Real scenarios expose issues synthetic tests miss.

**Includes**

* AVA documents
* persona material
* narrative tests

**DoD**

* AVA scenario runs with usable quality

---

# Sprint 5 — Back-office v1

---

## EPIC 5.1 — Scenario Builder v1

**Purpose**  
Enable non-developers to configure experiences.

**Description**  
Provide a simple web panel to create/edit scenarios, avatars, objectives, and sources.

**Hypothesis**  
Back-office usability is enough for MVP; no need for full consumer frontend yet.

**Includes**

* scenario config editor
* avatar config
* source upload
* save/load scenario

**DoD**

* non-dev can configure a scenario

---

## EPIC 5.2 — Live Test Console

**Purpose**  
Allow rapid iteration cycles.

**Description**  
Run conversations in-browser and inspect answers in real time.

**Hypothesis**  
Fast testing loops accelerate quality dramatically.

**Includes**

* test chat UI
* live streamed replies
* reset session

**DoD**

* scenario can be tested end-to-end in browser

---

## EPIC 5.3 — Logs & Metrics Dashboard

**Purpose**  
Turn telemetry into decisions.

**Description**  
Expose usage, latency, token, and cost data inside the back-office.

**Hypothesis**  
Visible metrics reduce waste and improve prioritization.

**Includes**

* session logs
* latency charts
* token/cost summaries

**DoD**

* team can compare runs and diagnose issues

---

# Sprint 6 — Stabilisation + Summer Demo

---

## EPIC 6.1 — Production Readiness v0

**Purpose**  
Make the MVP reliable enough for demos and external presentation.

**Description**  
Fix bugs, improve resilience, reduce friction, clean rough edges.

**Hypothesis**  
Stability matters more than adding last-minute features.

**Includes**

* bug fixing
* error handling
* edge case cleanup
* deployment checks

**DoD**

* MVP behaves consistently in demo conditions

---

## EPIC 6.2 — Benchmark Pack

**Purpose**  
Validate architectural choices with evidence.

**Description**  
Compare providers, measure latency percentiles, evaluate quality.

**Hypothesis**  
Evidence-based decisions outperform intuition.

**Includes**

* P50/P95/P99 latency
* 3+ model comparison
* scenario quality review

**DoD**

* benchmark report available

---

## EPIC 6.3 — Summer Prototype Delivery

**Purpose**  
Deliver the agreed MVP Scenario A.

**Description**  
A text-in/text-out conversational core with usable back-office and AVA scenario.

**Hypothesis**  
Scenario A is the right scope for summer success.

**Includes**

* back-office
* AVA scenario
* API
* core engine
* documentation

**DoD**

* working prototype demoable to external stakeholders

---

# Phase B — Enhanced Core (High Level)

Future EPIC groups:

* Voice pipeline
* Node memory + scenario graphs
* Multimedia triggers
* End-user frontend
* Multi-scenarios / multi-avatars
* Load tests + architecture competitions

---

# Phase C — Pre-Research Handoff (High Level)

Future EPIC groups:

* IDIAP contracts
* security / multi-tenant
* performance scaling
* SDK / integrations
* freeze / handoff package

---

# Final Rule

If a checkbox does not create standalone value, it should probably be part of an EPIC — not its own EPIC.