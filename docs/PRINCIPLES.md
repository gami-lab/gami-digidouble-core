# PRINCIPLES.md

## Why This Exists

This document defines how we make decisions.

Whenever there is doubt, complexity, or trade-offs — we come back here.

If a decision violates these principles, it must be challenged.

---

## 1. Experience First — Not Technology

We are not building an AI system.  
We are building **interactive experiences powered by AI**.

- The goal is not better models
- The goal is better conversations, immersion, learning, and engagement

👉 If it doesn’t improve the experience, it’s not worth it. :contentReference[oaicite:0]{index=0}

---

## 2. Orchestration Over Generation

Raw generation is not enough.

Value comes from:

- structuring context
- guiding progression
- managing state over time
- triggering the right actions at the right moment

The system must **decide before it generates**.

👉 The orchestration layer creates more value than the model alone.

---

## 3. Context is the Product

System quality depends on how context is:

- selected
- structured
- retrieved
- updated
- compacted

Not all information is useful. Most of it is noise.

👉 Mastering context is the core challenge.

---

## 4. Keep the Core Small

The Core must remain:

- minimal
- focused
- stable

Its main role is:

→ orchestrate interactive experiences

Everything else belongs outside:

- UI
- voice
- video rendering
- authoring tools
- content management

👉 If in doubt, it does **not** belong in the Core.

---

## 5. API is the Interface

The Core is accessed through clear contracts.

- No hidden coupling
- No direct frontend assumptions
- No provider-specific leakage
- Structured inputs / outputs

👉 If it cannot be exposed cleanly, it is wrongly designed.

---

## 6. LLM-Agnostic Always

We never depend on a single model or provider.

- Any provider can be replaced
- Multiple models can coexist
- Different roles may use different models
- Switching must stay practical

👉 The system owns the logic, not the model.

---

## 7. Separate Thinking from Speaking

Different responsibilities may require different intelligence modes:

- thinking (reasoning, planning, orchestration)
- speaking (persona response, style, conversation)

They should not be merged by habit.

👉 Structure first, expression second.

---

## 8. Async by Default, Blocking by Exception

Not every decision must delay the response.

Use asynchronous flows when possible:

- background analysis
- memory updates
- trigger preparation
- quality scoring

Only block when it materially improves the current exchange.

👉 Responsiveness matters.

---

## 9. Start Simple, Evolve When Needed

Avoid premature complexity.

- Prefer modular monolith over microservices early
- Prefer simple memory over theoretical memory
- Prefer working loops over elegant diagrams

👉 Complexity is earned, not assumed.

---

## 10. Measure Everything That Matters

We cannot improve what we do not observe.

At minimum:

- latency
- cost
- token usage
- retrieval quality
- conversation quality
- failure rates

👉 Every important decision should be measurable.

---

## 11. Optimize for Learning Speed

We are still discovering the right product and architecture.

The system must support:

- fast iteration
- experiments
- A/B comparisons
- rollback
- rapid prototypes

👉 The best architecture is the one that helps us learn faster.

---

## 12. Design for Evolution

We should expect:

- new models
- new interfaces
- new media formats
- new use cases
- new research modules

👉 Flexibility beats premature completeness.

---

## 13. Humans in the Loop — But Not the Bottleneck

Human judgment is valuable.

Use humans for:

- direction
- evaluation
- taste
- strategic corrections

Use automation for repetition and scale.

👉 Human leverage, not human dependency.

---

## 14. Memory Must Be Useful, Not Complete

Storing everything is easy. Using it well is hard.

- Keep what matters
- Forget what doesn’t
- Summarize when needed
- Retrieve when relevant

👉 Memory is a tool, not an archive.

---

## 15. One Clear Responsibility per Component

Examples:

- Game Master → orchestrate
- Avatar → interact
- Context Manager → assemble relevant context
- Memory Layer → persist and retrieve
- Delivery Layer → present outputs

👉 If a component does too much, redesign it.

---

## 16. Build for Real Use, Not Demo

The system must survive reality:

- long sessions
- noisy inputs
- cost constraints
- multiple scenarios
- imperfect content
- operator mistakes

👉 If it only works in demos, it does not work.

---

## 17. Constraints Drive Creativity

Limits are design inputs:

- token windows
- latency
- budget
- small team bandwidth
- time-to-market

👉 Use constraints to sharpen choices.

---

## 18. Default to Clarity

Every important part should be:

- understandable
- explainable
- testable
- debuggable

👉 If we cannot reason about it, we cannot trust it.

---

## 19. Content and Engine Stay Decoupled

Experiences, scenarios, avatars, and media should evolve without rewriting the engine.

👉 The platform grows faster when content is configurable.

---

## Final Rule

When in doubt:

> Build the simplest system that can deliver a coherent, evolving, measurable experience.

Everything else is secondary.
