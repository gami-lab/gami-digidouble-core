# Prompt 1 — Create Scenario: “AI Guided Discovery” (3 Avatars, Unlockable Specialists)

You are an expert product engineer + architect working on the Gami DigiDouble Core project.

Your task is to implement and seed a **testable scenario** that will become the reference multi-avatar acceptance scenario after EPIC 4.4.

Use existing project docs (`VISION.md`, `EPICS.md`, `API_CONTRACT.md`, `DATA_MODEL.md`, `GAME_MASTER_CONTRACT.md`, `PROJECT_STATUS.md`) and align with the current architecture.

## Objective

Create a scenario named:

**AI Guided Discovery**

This scenario demonstrates guided conversation, avatar routing, unlockable specialists, bounded competence, and session continuity.

It must be usable through API + Console.

---

## Core Experience

The user enters a guided experience to learn about AI.

There are **3 avatars**:

### Avatar A — Generalist Guide

Role:

- friendly and knowledgeable AI guide
- first contact for all users
- broad overview of AI
- explains concepts simply
- detects when user needs deeper expertise
- introduces specialists only when relevant

Behavior:

- can answer general AI questions
- should NOT go too deep technically or ethically
- when relevant, mentions specialists:

Examples:

- “If you’d like to understand how models work internally, I can introduce Theo.”
- “If you’d like to discuss risks and ethics, I can introduce Eva.”

This avatar is available immediately.

---

### Avatar B — Technology Specialist

Suggested name: **Theo**

Role:

- expert in technical AI topics

Topics:

- LLMs
- transformers
- embeddings
- training / inference
- RAG
- agents
- latency / cost / scaling
- models/providers

Behavior:

- should redirect ethical/social questions back to A or C
- should not become generic life coach

Locked at session start.

Unlocked only after Avatar A introduces Theo.

---

### Avatar C — Ethics Specialist

Suggested name: **Eva**

Role:

- expert in ethics and responsible AI

Topics:

- bias
- fairness
- transparency
- privacy
- regulation
- human oversight
- societal impact
- trust

Behavior:

- should redirect deep technical implementation questions back to A or B

Locked at session start.

Unlocked only after Avatar A introduces Eva.

---

## Required Product Behavior

### Unlock Rules

At session start:

- available avatars = A only

When A introduces Theo:

- B becomes available in session state

When A introduces Eva:

- C becomes available in session state

User cannot access locked avatars.

### Routing Rules

- User may stay with A
- Once unlocked, user may switch to B or C
- Returning to A creates a new conversation episode
- Switching between avatars follows session/conversation model

### Competence Boundaries

Each avatar must remain inside its domain.

We prefer:

- graceful redirect
- acknowledge limitation
- suggest proper specialist

### Example

User asks A:
“How does ChatGPT technically work?”

A gives overview and proposes Theo.

User unlocks B.

B explains transformers and inference.

Later user asks:
“Is this dangerous for society?”

B redirects to C or A.

---

## Technical Deliverables

Implement as data/config first, not hardcoded logic.

### Scenario seed

Create a repeatable seed script that creates:

- scenario
- avatars A / B / C
- prompts/config
- unlock rules
- routing policy
- pacing defaults

### Required files (adapt to repo structure)

Examples:

- `seed/ai-guided-discovery.ts`
- scenario config JSON
- test fixtures

### Documentation

Update:

- `PROJECT_STATUS.md`
- relevant docs if schema/config changed

---

## Acceptance Tests

Must support deterministic tests:

### Test 1

New session:

- only A visible

### Test 2

Ask technical question to A:

- B unlocked

### Test 3

Ask ethics question to A:

- C unlocked

### Test 4

Try opening locked B before unlock:

- rejected cleanly

### Test 5

B asked ethics question:

- redirects to C or A

### Test 6

C asked deep infra question:

- redirects to B or A

### Test 7

A → B → A creates multiple conversations in same session

---

## Constraints

- KISS
- configurable over hardcoded
- no giant prompts
- deterministic policy where possible
- preserve existing contracts unless versioned
- tests must pass

## Output Expected

1. Code changes
2. Seed data
3. Tests
4. Updated docs
5. Short implementation summary
