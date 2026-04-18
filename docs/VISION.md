# VISION.md

## Purpose

We are building a new kind of system to create and run **interactive, conversational experiences** — where users don’t just consume content, but engage with it through dialogue, exploration, and narrative.

Today, most learning, storytelling, and simulation tools are static, linear, or hard to adapt. They do not respond to the user in a meaningful, contextual way.

Our goal is to change that.

We want to enable experiences where:

- conversations feel natural and evolving
- context is remembered and used intelligently
- content adapts to the user, not the opposite
- media and interactions can be triggered dynamically during the experience

This is about moving from **content delivery → interactive experience orchestration**. :contentReference[oaicite:0]{index=0}

---

## What We Build

We build a **Core Engine** that orchestrates conversational experiences.

This Core is not an application, but a **foundation layer** used by multiple products (learning, storytelling, simulations, cultural mediation, training, etc.).

At its heart, the system:

- receives user input
- understands the situation and context
- decides how the experience should evolve
- generates a coherent response through an avatar
- can trigger structured outputs (text, media, events, actions)

The system is structured around a few key concepts:

- **Game Master**
  A central orchestrator that understands the global state and guides the experience asynchronously through triggers and directives.

- **Avatar(s)**
  Entities that interact with the user, each with identity, personality, autonomy, and memory.

- **Context** (3 dimensions)
  - Memory (what happened before)
  - Experience (the world, rules, objectives)
  - Knowledge (external sources and content)

Together, these elements create a system capable of producing **coherent, evolving conversations over time**, not just isolated answers. :contentReference[oaicite:1]{index=1} :contentReference[oaicite:2]{index=2}

---

## How We Build It (Principles)

We deliberately design the system with strong guiding principles:

### 1. API-First Foundation

Everything is exposed through clear APIs.
The Core is independent from any interface (UI, voice, video, builder tools, external apps).

→ Multiple products and clients can plug into the same engine.

---

### 2. LLM-Agnostic by Design

The system is not tied to a single AI provider.

We can switch between:

- commercial models
- open-source models
- local/self-hosted models

→ This ensures flexibility, cost control, and long-term independence.

---

### 3. Separation of Concerns

We clearly separate:

- orchestration (Game Master)
- interaction (Avatar)
- context (memory, world, knowledge)
- delivery layers (UI, voice, video, media players)

→ This keeps the architecture modular and evolvable.

---

### 4. Context as a First-Class Concept

The quality of the experience depends on how context is managed.

We treat context as a structured system:

- not everything is kept
- only what matters is injected

---

### 5. Trusted and Operable in Production

Building a great conversation is not enough.

The platform must also be:

- observable by operators — not just by reading raw logs
- inspectable at runtime — sessions, memory, GM state, ingestion jobs
- diagnosable without requiring a code change or a database query
- recoverable by humans — reset, replay, retry without engineering intervention
- measurable over time — usage, cost, errors, quality signals

→ An experience that cannot be confidently operated is not a product.

We are building a **back-office control plane** alongside the conversational engine.
These two capabilities must arrive together, not sequentially.

- memory is compacted over time
- relevant knowledge is retrieved dynamically

→ Context management is one of the main technical differentiators.

---

### 5. Product-Agnostic Core

The Core does not include:

- UI
- voice systems
- video avatars
- editing/builder tools
- content authoring systems

These are separate layers built on top.

→ This keeps the Core reusable across multiple products.

---

### 6. Testable, Observable, Measurable

From day one, the system is designed to:

- measure latency, cost, token usage
- evaluate quality (consistency, relevance, persona fidelity)
- compare models and architectures
- benchmark scenarios over time

→ This enables evidence-based iteration.

---

### 7. Lean MVP, Strong Foundations

We start simple:

- TypeScript application core
- PostgreSQL + pgvector
- Redis
- local-first development
- modular wrappers around providers

We add complexity only when justified by real bottlenecks.

→ Speed now, optional scale later. :contentReference[oaicite:3]{index=3} :contentReference[oaicite:4]{index=4}

---

### 8. Self-Hosted and Open

The Core can run anywhere:

- locally
- private infrastructure
- sovereign cloud environments

It is designed to be:

- portable
- inspectable
- independent from mandatory external services

---

## Roadmap Direction

### Phase A — Minimal Core

Validate the fundamental loop:

user input → context assembly → avatar response → memory update

Deliver a usable back-office and text-based prototype.

### Phase B — Enhanced Experiences

Add:

- voice input/output
- multimedia triggers
- multiple scenarios
- richer memory systems
- user-facing frontend

### Phase C — Research & Scale Readiness

Prepare the platform for advanced integrations such as expressive avatars, advanced persona systems, scaling, SDKs, and research partnerships. :contentReference[oaicite:5]{index=5}

---

## What Success Looks Like

We succeed when:

- a user can engage in a long, coherent conversation
- the system remembers and adapts over time
- avatars feel alive, not scripted
- media can appear naturally when useful
- new experiences can be launched quickly by creators
- multiple products can reuse the same Core

Ultimately, this Core becomes a **platform for interactive intelligence**, enabling a new generation of learning, storytelling, and simulation products.
