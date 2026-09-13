# Vision

Gami DigiDouble Core is a headless engine for guided interactive experiences: conversations that
remember what matters, adapt to the user, and progress toward scenario goals.

Most learning, storytelling, and simulation tools today are static, linear, or hard to adapt — they
do not respond to the user in a meaningful, contextual way. This platform exists to move from
**content delivery** to **interactive experience orchestration**.

Core is a reusable platform layer, not an application. It coordinates:

- **Avatar** — the direct conversational actor.
- **Game Master** — the asynchronous director of progression, routing, and guidance.
- **Context** — bounded conversation state, scenario content, and retrieved knowledge.
- **Operations** — inspection, diagnostics, and human recovery tools.

Clients and products consume Core through HTTP/SSE contracts. Web, admin, console, voice, and media
delivery remain separate layers.

## Core concepts

- **Game Master** — a central orchestrator that understands global session state and guides the
  experience asynchronously through triggers and directives, without blocking the Avatar reply.
- **Avatar(s)** — interaction surfaces, not the product itself. Each has identity, personality,
  autonomy, and memory.
- **Context** — three dimensions: memory (what happened before), experience (the world, its rules,
  and objectives), and knowledge (external sources and content). Not everything is kept; only what
  matters is injected, and memory is compacted over time. Context management is a main technical
  differentiator, not an implementation detail.
- **Operations** — the back-office control plane. An experience that cannot be confidently operated
  is not a product, so inspection, diagnostics, and recovery tooling ship alongside the
  conversational engine, not after it.

## Principles

- **API-first.** Core is independent of any interface (UI, voice, video, builder tools, external
  apps), so multiple products can plug into the same engine.
- **LLM-agnostic.** The system is not tied to one AI provider — commercial, open-source, and
  self-hosted models must all be swappable, for flexibility, cost control, and long-term
  independence.
- **Separation of concerns.** Orchestration (Game Master), interaction (Avatar), context (memory,
  world, knowledge), and delivery layers (UI, voice, media players) stay clearly separated so the
  architecture remains modular and evolvable.
- **Trusted and operable in production.** Building a good conversation is not enough: the platform
  must be observable by operators (not just via raw logs), inspectable at runtime, diagnosable
  without a code change or database query, recoverable by humans (reset/replay/retry), and
  measurable over time (usage, cost, errors, quality).
- **Product-agnostic core (non-goal).** Core deliberately excludes UI, voice systems, video avatars,
  and content-authoring/editing tools. These are separate layers built on top, which is what keeps
  Core reusable across learning, storytelling, simulation, cultural-mediation, and training products
  rather than becoming one product's backend.
- **Testable, observable, measurable.** From day one the system measures latency, cost, and token
  usage, evaluates quality (consistency, relevance, persona fidelity), and supports comparing models
  and architectures — enabling evidence-based iteration instead of subjective judgment calls.
- **Lean MVP, strong foundations.** Start simple (TypeScript core, PostgreSQL + pgvector, Redis,
  local-first development, modular provider wrappers) and add complexity only when a real bottleneck
  justifies it.
- **Self-hosted and open.** Core must be able to run locally, on private infrastructure, or in a
  sovereign cloud environment — portable, inspectable, and independent from mandatory external
  services.

## Product direction

Phase A validates the loop:

`user input -> context assembly -> Avatar response -> asynchronous GM/memory work`

The next increments should improve guided progression, real-scenario quality, operator recovery,
and response reliability only when they preserve the Core boundaries above and remain measurable.

### Roadmap phases

- **Phase A — Minimal Core (current).** Validate the fundamental loop and deliver a usable
  back-office alongside a text-based prototype.
- **Phase B — Enhanced Experiences (next).** Voice input/output, multimedia triggers, multiple
  scenarios, richer memory systems, and a user-facing frontend. Voice I/O and the public web app
  have already shipped ahead of a full Phase B; multi-scenario support and dynamic media triggers
  remain open (see `EPICS.md`).
- **Phase C — Research & Scale Readiness (future).** Expressive avatars, advanced persona systems,
  scaling, SDKs, and research partnerships.

## In practice

- Core lives in `apps/core`; `apps/console`, `apps/web`, and `apps/admin` are separate consumer
  layers that prove the API-first principle rather than special-cased Core code paths.
- `tools/conversation-evaluation` is a separate client that exercises the "testable, observable,
  measurable" principle without becoming part of the Core domain.
- Optional Deepgram (speech-to-text) and Gradium (text-to-speech) integrations are the current proof
  of the provider-agnostic principle applied beyond LLMs: the platform stays fully functional on
  text alone when they are unconfigured.

## Success criteria

- Conversations remain coherent over time without replaying unbounded history.
- Scenario content and Avatar behavior can evolve without code changes to orchestration.
- Avatar transitions feel intentional and scenario-driven, not arbitrary.
- Operators can understand and recover runtime behavior safely, without engineering intervention.
- New experiences can be launched quickly by creators, and media can appear naturally when useful.
- Multiple clients and products can reuse the same Core contracts.
