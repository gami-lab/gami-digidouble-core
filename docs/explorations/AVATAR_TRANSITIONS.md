# Avatar Transitions & Multi-Avatar Navigation

## Purpose

Investigate how a user moves from one avatar to another during an experience.

Today the platform supports conversation with one avatar, but a multi-avatar experience requires clear routing, UX, state management, and orchestration rules.

---

# Core Questions

## Product Questions

- How does the user know multiple avatars are available?
- Can the user choose freely who to talk to?
- Can the system recommend or force transitions?
- Is switching instant or contextualized?
- Can multiple avatars answer in sequence?

## Experience Questions

- Should transitions feel like menu navigation or natural storytelling?
- Should avatars introduce each other?
- Should transitions be explicit or invisible?
- How much control should the user have?

## Technical Questions

- What is the active avatar in session state?
- What memory is shared vs avatar-specific?
- How are transitions logged?
- How does the GM decide when to switch?

---

# Possible Models

## Model A — User Driven

User chooses avatar from list / map / cast.

### Pros

- Clear
- Simple UX
- Easy to implement
- Predictable

### Cons

- Less immersive
- Less pedagogical guidance

---

## Model B — GM Guided

Game Master suggests best next avatar.

Example:

> You may want to ask Anna about this topic.

### Pros

- Guided journey
- Better learning flow
- Keeps narrative coherence

### Cons

- More orchestration logic needed

---

## Model C — Scenario Driven

Automatic switch based on story progress.

Example:

- User completes phase 1
- New avatar enters scene

### Pros

- Strong immersive storytelling

### Cons

- Can frustrate user if too rigid

---

## Recommended MVP Approach

Hybrid:

- User can choose manually
- GM can recommend
- Scenario can trigger key transitions

---

# Required State Model

```ts
session {
  activeAvatarId
  availableAvatarIds[]
  transitionHistory[]
  sharedMemory
}
```

Each avatar:

```ts
avatarState {
  memory
  relationshipLevel
  emotionalState
}
```

---

# UI Ideas

- Avatar sidebar
- Character map
- “Talk to…” button
- Recommended next person
- Smooth transition message

---

# Metrics

- Number of switches per session
- Time spent per avatar
- Drop-off after switch
- User accepted recommendations %
- Satisfaction after transitions

---

# MVP Scope

## Must Have

- Active avatar
- Manual switch
- Transition event logs

## Nice to Have

- GM recommendations
- Auto transitions
- Multi-avatar conversations

---

# Decision To Make

Should avatar switching be:

1. Navigation feature
2. Pedagogical orchestration feature
3. Storytelling mechanic

Likely answer: all three, in phases.
