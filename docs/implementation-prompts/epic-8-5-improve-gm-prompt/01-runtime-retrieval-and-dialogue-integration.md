# Prompt 2 — Integrate GM Retrieval Planning and Dialogue Control

## Objective

Update Game Master output into the next Avatar-turn pipeline.
The task is to update the existing flow to take into account the new output of the GM prompt.

The GM must remain a post-analysis component. Its stored output prepares the next turn without delaying the current Avatar response.

## Required runtime flow

The runtime flow is not modified.

```text
User message
→ Avatar response using stored GM guidance
→ asynchronous GM post-analysis
→ store GM output
→ next user message
→ consume stored GM output
→ perform retrieval
→ build Avatar prompt
→ Avatar response
```

## 1. Store the GM result as next-turn orchestration state

Persist the GM result against:

- session ID;
- active Avatar ID;
- completed turn index;
- generation timestamp or version.

Example:

```json
{
  "sessionId": "session-id",
  "activeAvatarId": "avatar-id",
  "generatedAfterTurn": 7,
  "dialogueControl": {
    "mode": "repair",
    "askFollowUp": false
  },
  "retrievalPlan": {
    "required": true,
    "queries": [
      "Mona current location",
      "Mona quarantine camp",
      "what Max knows about Mona's location"
    ],
    "requiredFacts": ["Mona's last confirmed location", "what Max currently knows"]
  },
  "directorNotes": "Resolve the location contradiction before progressing.",
  "progressionUpdate": {
    "progression": "none"
  }
}
```

The orchestration state must indicate the turn that produced it.

A new GM result replaces the previous unconsumed result for the same session and active Avatar.

## 2. Consume the retrieval plan on the next Avatar turn

When the next user message arrives:

1. Load the latest stored GM orchestration state.
2. Read its `retrievalPlan`.
3. Combine the stored retrieval intent with the new user message.
4. Execute RAG retrieval.
5. Inject the retrieved context into the Avatar prompt.
6. Mark the retrieval plan as consumed for that turn.

## 5. Inject dialogue control into the Avatar prompt

Add a structured section:

Example for repaire mode, with followup question

```text
## Game Master Guidance

Dialogue mode:
Resolve the contradiction, misunderstanding, or unsupported claim before progressing.
Do not introduce a new topic until the issue is clarified.
Follow-up question: yes

Director note:
Resolve the location contradiction before progressing.
```

Example for user_led, without follow up question

```text
## Game Master Guidance

Dialogue mode:
Answer the user's question directly. Let the user control the sequence. Do not add a generic follow-up question.
Follow-up question: no
```

Update the permanent Avatar prompt rules to define the modes:

```text
- user_led:
  Answer the user's question directly.
  Let the user control the sequence.
  Do not add a generic follow-up question.

- avatar_guided:
  Answer directly.
  You may offer one focused question or next direction.

- avatar_led:
  Take initiative.
  Introduce one meaningful topic, recollection, or question.

- repair:
  Resolve the contradiction, misunderstanding, or unsupported claim before
  progressing.
  Do not introduce a new topic until the issue is clarified.

- transition:
  Close the current topic naturally and move toward the indicated subject or
  Avatar.

- Respect the Game Master's askFollowUp value.
  When false, do not end with a question unless clarification is required to
  understand the user's request.
```

Remove the generatic instruction for the avatar to Follow up on questions

## 6. Keep Director Notes simple

Inject Director Notes as text only when present.

Do not implement a separate constraint engine.

The application only needs deterministic handling for:

- dialogue mode;
- follow-up flag;
- retrieval plan;
- routing;
- progression.

Director Notes remain prompt guidance interpreted by the Avatar model.

## 7. Apply routing deterministically

Supported actions:

### `stay`

No state change.

### `suggest`

Keep the current Avatar active.

Expose the suggestion using the existing product mechanism.

### `switch`

Set the specified active and unlocked Avatar as the next active Avatar.

### `unlock`

Unlock the specified Avatar or Avatars.

Do not automatically switch.

### `unlock_and_switch`

Unlock the specified Avatar and make it the next active Avatar.

Validate every action against the current scenario state.

Invalid actions must safely fall back to:

```json
{
  "action": "stay"
}
```

## 8. Apply progression separately

When:

```json
"progression": "increase"
```

update progression through the existing application mechanism.

Do not use the GM output to update:

- working-memory summary;
- covered topics;
- unresolved memory threads;
- candidate facts;
- interaction count.

## 9. Consumption and failure handling

The next-turn orchestration state must not remain active indefinitely.

After it is used:

- mark it consumed;
- or replace it with the next GM result.

If the GM call fails:

- preserve the last safe dialogue defaults;
- do not reuse an old mandatory retrieval plan indefinitely;
- default dialogue control to `user_led` or the current product default;
- keep the current Avatar;
- do not increase progression.

## Acceptance criteria

- The current Avatar response is never delayed by the GM.
- The next Avatar turn can use GM-generated retrieval queries.
- Retrieval queries are combined with the latest user message.
- Mandatory retrieval failure does not cause fabricated answers.
- Dialogue modes influence Avatar response behaviour.
- `askFollowUp: false` prevents mechanical closing questions.
- Routing actions are validated before application.
- Stale GM guidance is not reused indefinitely.
- Existing Avatar-generation behaviour still works when no GM state is available.
