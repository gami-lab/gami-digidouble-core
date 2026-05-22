---
scenarioId: murder-party-villa-miralac
name: Manual QA Test Script
type: qa
---

# Manual QA Test Script

## Test 1 — Initial session

Start a new session.

Expected:

- only Clara is available
- Clara introduces the situation
- Clara mentions the other suspects
- GM unlocks the other avatars after the introduction or after user asks

Suggested user message:

> Please tell me what happened tonight.

Expected Clara behavior:

- explains Lionel was found dead
- mentions winter garden
- mentions Elias, Margot, Thomas
- does not accuse anyone directly

## Test 2 — Avatar visibility

Ask Clara:

> What do you know about Elias's medical scandal?

Expected:

- Clara may mention the phrase "borrowed lives"
- Clara should not know the full clinical trial truth
- Clara should not know that Elias definitely killed Lionel

Ask Elias:

> What did Clara see you doing near the study?

Expected:

- Elias may minimize or deny suspicious interpretation
- Elias should not know exactly what Clara will testify unless revealed

## Test 3 — Murderer denial

Ask Elias:

> Are you guilty?

Expected:

- Elias denies guilt
- Elias reframes death as heart attack
- Elias may redirect suspicion to Margot or Thomas

## Test 4 — Timeline contradiction

Ask Thomas:

> Where were you between 22:05 and 22:30?

Expected:

- Thomas resists at first
- if pressed, admits he was in the library
- reveals Elias was near the terrace around 22:20
- this contradicts Elias

## Test 5 — False lead Margot

Ask Margot:

> Did you take something from Lionel's study?

Expected:

- Margot denies or evades first
- if pressed, admits she took an envelope
- explains it was about inheritance
- does not confess to murder

## Test 6 — Crime scene RAG

Ask any avatar:

> What was found near the body?

Expected:

- public crime scene knowledge can surface
- avatar answer should stay in-character
- no private GM truth should leak

## Test 7 — Final accusation not ready

Accuse Elias early with no evidence.

Expected:

- Elias denies
- GM should not mark scenario solved
- GM may guide user to collect stronger evidence

## Test 8 — Final accusation ready

Confront Elias with:

- digitalis
- his access to medical substances
- Clara seeing him with the medical case
- Thomas seeing him near the terrace
- Lionel threatening to expose the trial

Expected:

- Elias loses composure
- may confess or make a near-confession
- GM marks scenario solved

## Test 9 — Memory across conversations

After speaking with Clara, close the conversation and start with Thomas.

Expected:

- session memory should preserve relevant discoveries
- Thomas should not magically know private Clara-only memory
- GM can use discoveries to guide the next interrogation

## Test 10 — Runtime inspector

Inspect:

- active avatar
- unlocked avatars
- selected context
- excluded visibility counts
- GM unrestricted retrieval
- conversation working memory
- episodic memory after closure

Expected:

- visibility filtering is explainable
- GM access is asymmetrical and visible through bounded diagnostics
