# Hybrid Response Engine

## Purpose

Investigate whether all avatar answers should be generated live by LLM, or if a hybrid model would improve latency, cost, quality, and testability.

---

# Current Problem

Pure live generation creates:

- Higher latency
- Higher token cost
- Variable quality
- Harder regression testing
- More hallucination risk

For educational experiences, many user questions are repetitive and predictable.

---

# Core Idea

Use 3 response layers:

1. Pre-generated canonical answers
2. Semantic retrieval of similar answers
3. Live generation fallback

---

# Layer 1 — Canonical Answers

When creating an avatar, generate likely user questions.

Examples:

- Who are you?
- Why does plastic pollute oceans?
- What happened to your family?
- How can I help?

Store approved answers.

### Benefits

- Instant replies
- Stable quality
- Easy testing
- Cheap

---

# Layer 2 — Semantic Matching

When user asks:

> Why is plastic dangerous in sea water?

System searches closest known question.

If confidence high:

- reuse answer
- lightly rewrite in avatar voice

### Benefits

- Fast
- Natural variation
- Covers many common cases

---

# Layer 3 — Live Generation

Used when:

- no good match exists
- creative answer needed
- user asks novel question
- contextual reasoning needed

### Benefits

- Flexibility
- Richness
- Personalization

---

# Learning Loop

All unmatched questions are stored.

Offline process:

- cluster repeated questions
- generate better canonical answers
- validate quality
- add to database

System becomes stronger over time.

---

# Architecture Components

## Data

```ts
QuestionAnswer {
  avatarId
  question
  embedding
  answer
  tags[]
  source
  qualityScore
}
```

## Runtime Flow

1. Detect intent
2. Search similarity
3. If high confidence → reuse
4. Else generate
5. Log result

---

# Confidence Strategy

## High confidence

Return cached answer.

## Medium confidence

Reuse + LLM rewrite.

## Low confidence

Generate fresh answer.

---

# Metrics

- Cache hit rate
- Average latency
- Token reduction %
- User satisfaction
- Hallucination rate
- Repeated unmatched questions

---

# Risks

## Too Static

Answers feel repetitive.

Mitigation:

- multiple variants
- light rewriting

## Wrong Match

Bad semantic retrieval.

Mitigation:

- confidence thresholds

## Maintenance Overhead

Need content pipeline.

Mitigation:

- automate generation

---

# MVP Recommendation

## Phase 1

- canonical Q/A store
- semantic search
- fallback LLM

## Phase 2

- automatic enrichment from conversations

## Phase 3

- personalized per user profile

---

# Strategic Value

This model may become a major differentiator:

Better UX than pure LLM chat
Lower cost than competitors
More controllable educational outcomes
More testable platform
