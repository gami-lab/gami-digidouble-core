# Game Master Contract and State Model (MVP — Async Director / Actor Model)

## Purpose

This document defines the **minimal executable contract** of the Game Master for the MVP.

The goal is simple:

👉 Make the system buildable **without overengineering**

We deliberately apply:

* **KISS (Keep It Simple)**
* **YAGNI (You Aren’T Gonna Need It)**

---

# 1. Role of the Game Master (MVP)

The Game Master is a **light asynchronous orchestrator**.

It is **not in the critical response path** during normal conversation.

The Avatar speaks directly to the user for minimal latency.
The Game Master observes in the background and intervenes when useful.

This is a **Director / Actor model**:

* **Avatar = Actor**

  * has its own intelligence
  * has its own memory
  * has its own personality
  * answers directly to the user

* **Game Master = Director**

  * watches the conversation
  * detects moments where guidance helps
  * injects context or directives asynchronously
  * manages lightweight progression state

Its job is only to:

* decide which avatar the user interacts with
* initialize context at session start
* observe ongoing conversations in background
* trigger guidance when needed
* update a very small state

👉 In early session startup, the GM may run synchronously.
👉 During live conversation, the Avatar should remain autonomous whenever possible.

---

# 2. Design Principles (MVP)

## 2.1 Minimal control

The Game Master should interfere as little as possible.

If the Avatar can handle something alone → let it.

## 2.2 No over-structuring

Avoid:

* complex strategies
* emotional modeling
* deep classification

## 2.3 Context, not behavior

The Game Master provides context.

The Avatar decides how to behave.

## 2.4 Minimal state

Only keep what is strictly needed to:

* maintain progression
* avoid repetition
* track interaction

---

# 3. Turn Pipeline (Async Model)

## Session Start

1. User starts session
2. Game Master selects avatar and initial context
3. Avatar receives setup
4. Avatar responds to user

## Ongoing Conversation

1. User sends message
2. Avatar responds directly using its own memory
3. Game Master observes in background
4. If a trigger fires, GM updates future context/instructions
5. State is updated asynchronously

This removes the double-latency problem of sequential two-LLM calls.

---

# 4. Game Master Input (Simplified)

```ts
export type GameMasterInput = {
  session: {
    sessionId: string
    turnIndex: number
  }

  userMessage: {
    text: string
  }

  state: GameMasterState

  context: {
    experience: {
      scenarioId: string
      description?: string
    }

    availableAvatars: Array<{
      avatarId: string
      name: string
      description?: string
    }>
  }
}
```
---

# 5. Game Master Output (Minimal)

```ts
export type GameMasterOutput = {
  avatarId: string

  conversationMode: "new" | "continue"

  context?: {
    notes?: string
  }

  stateUpdate: {
    progression?: "none" | "increase"
    topicCovered?: string
    interactionIncrement: 1
  }
}
````

---

# 6. State Model (Minimal)

Only keep what we actually need.

```ts
export type GameMasterState = {
  currentAvatarId?: string

  progression: string

  topicsCovered: string[]

  interactionCount: number
}
```

---

# 7. State Meaning

## progression

A simple description 

Used to:

* track progress in the experience
* know if we move forward

## topicsCovered

Used to:

* avoid repetition
* know what has already been discussed

## interactionCount

Used to:

* detect long sessions
* trigger future improvements later (compaction, etc.)

## currentAvatarId

Used to:

* know if we continue with the same avatar
* or switch to another one

---

# 8. Core Decisions (MVP)

The Game Master only makes 3 decisions:

## 8.1 Which avatar?

* choose initial avatar
* optionally switch later

## 8.2 Should I intervene?

* no → Avatar continues alone
* yes → inject guidance asynchronously

## 8.3 What context to provide?

Examples:

* "User is new to this topic"
* "Go deeper on uncertainty"
* "Move toward next objective"

👉 This is guidance, not control.

---

# 9. State Update Rules (Simple)

## Progression

Increase when:

* user explores the topic
* conversation moves forward

Otherwise:

* keep as is

## Topics

Add topic when:

* a meaningful concept is discussed

## Interaction count

Always:

```ts
interactionCount += 1
```

---

# 10. What the Game Master Does NOT Do (MVP)

The Game Master does NOT:

* answer every user message in sequence
* block the Avatar response path
* manage conversation memory → Avatar does
* control tone → Avatar does
* enforce strict dialogue flow
* classify emotions deeply
* run heavy retrieval pipelines on every turn
* orchestrate complex strategies

---

# 11. Example (MVP)

## Input

User: "Tell me more about plastic pollution"

State:

* currentAvatarId: "peter"
* progression: "introduction done"
* topicsCovered: ["plastic"]
* interactionCount: 3

---

## Output

```json
{
  "avatarId": "peter",
  "conversationMode": "continue",
  "context": {
    "notes": "User already started exploring plastic pollution, go deeper"
  },
  "stateUpdate": {
    "progression": "increase",
    "topicCovered": "plastic_pollution",
    "interactionIncrement": 1
  }
}
```

---

# 12. Implementation Guidance (MVP)

Start extremely simple.

## Step 1 — No GM during live turns

* Avatar answers directly
* GM only used at session start

## Step 2 — Add background observer

Every N turns or every X seconds:

* inspect conversation
* optionally produce new context notes

## Step 3 — Trigger examples

* after 5 interactions
* topic repeated too often
* progression stalled
* user reached milestone

## Step 4 — Keep reducer simple

```ts
state.interactionCount += 1
if (gm.progression === "increase") state.progression += 1
if (gm.topicCovered) state.topicsCovered.push(gm.topicCovered)
```

## Step 5 — Observability from day 1

Track:

* prompt
  n- completion
* latency
* tokens
* cost
* feedback thumbs up/down

Optional later:

* quality reviewer LLM on sample conversations

---

# 13. Evolution Path (Later)

Only add complexity when needed:

* richer state (engagement, emotion)
* retrieval (RAG)
* multi-step strategies
* system actions

Not before.

---

# Final Rule

If the Avatar can handle it →
👉 **The Game Master should not exist for that decision.**

The GM is here to **route and lightly guide**, not to control everything.
