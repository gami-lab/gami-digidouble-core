# Prompt 1 — Refactor the Game Master Contract and Prompt

## Objective

Refactor the asynchronous Game Master prompt and output contract so that the GM produces useful preparation for the next Avatar turn while remaining a single post-analysis call.

The Game Master must remain asynchronous:

1. User sends a message.
2. Avatar responds using the previously stored GM guidance.
3. GM analyses the completed exchange asynchronously.
4. GM output is stored and used during the next Avatar turn.

Do not introduce another GM call and do not add GM latency before the current Avatar response.

## Required changes

### 1. Replace the existing GM output contract

Remove the current overlapping fields:

```text
avatarId
nextAvatarId
transitionReason
recommendedChoices
unlockAvatarIds
unlockDecisions
suggestedAvatarId
suggestedAvatarReason
conversationMode
stateUpdate.topicCovered
stateUpdate.activeAvatarId
stateUpdate.interactionIncrement
```

Replace them with the following logical structure:

```json
{
  "dialogueControl": {
    "mode": "user_led",
    "askFollowUp": false
  },
  "retrievalPlan": {
    "required": true,
    "priority": "mandatory",
    "queries": ["Mona current location", "what Max knows about Mona's location"],
    "requiredFacts": [
      "Mona's last confirmed location",
      "what Max currently knows about her location"
    ]
  },
  "directorNotes": "Keep the next answer factual and distinguish Mona's previous location from her current confirmed location.",
  "routing": {
    "action": "stay"
  },
  "progressionUpdate": {
    "progression": "none"
  }
}
```

Optional fields must be omitted when they are not needed.

### 2. Add explicit dialogue-control modes

Supported modes:

```text
user_led
avatar_guided
avatar_led
repair
transition
```

Definitions:

- `user_led`: the user is directing the discussion. The Avatar should answer directly and avoid generic follow-up questions.
- `avatar_guided`: the Avatar should answer directly and may offer one focused next direction.
- `avatar_led`: the Avatar should take initiative and move the discussion forward.
- `repair`: the next response must resolve a contradiction, misunderstanding, or loss of trust before progressing.
- `transition`: the current subject should close or move toward another subject or Avatar.

The output must also include:

```json
"askFollowUp": true
```

or:

```json
"askFollowUp": false
```

Do not infer follow-up behaviour solely from the mode.

### 3. Add RAG planning as a first-class output

Add:

```json
"retrievalPlan": {
  "required": true,
  "priority": "mandatory",
  "queries": [],
  "requiredFacts": []
}
```

Optional source scopes may be included if supported:

```json
"scopes": [
  "avatar_memory",
  "world_context",
  "scenario_knowledge"
]
```

The GM does not perform retrieval. It prepares retrieval for the next Avatar turn.

Use `mandatory` when:

- the user corrected the Avatar;
- recent Avatar replies contradict one another;
- the discussion concerns an exact event, person, location, object, or timeline;
- the answer depends on what the Avatar knows versus canonical world truth;
- a previous Avatar statement may be unsupported;
- the current topic is likely to continue and exact grounding is required.

Queries must be short, precise, and retrieval-oriented.

Good:

```json
[
  "Mona current location after staying with grandfather",
  "Mona quarantine camp",
  "what Max knows about Mona's location",
  "whether Mona travelled to the chalet"
]
```

Avoid generic queries such as:

```json
["Mona information", "family story"]
```

### 4. Keep Director Notes, but make them optional

Keep:

```json
"directorNotes": "<compact next-turn guidance>"
```

Director Notes should express narrative or character guidance that is not already represented by the structured fields.

Good:

```text
Answer from Max's limited knowledge and let his guilt appear indirectly.
```

Bad:

```text
Continue in character and remain concise.
```

The second example repeats permanent Avatar rules and should be omitted.

### 5. Normalize Avatar routing

Use one routing object:

```json
"routing": {
  "action": "stay | suggest | switch | unlock | unlock_and_switch",
  "avatarId": "<optional>",
  "reason": "<optional>"
}
```

Rules:

- `stay` does not require `avatarId`.
- `suggest` and `switch` require an active, unlocked Avatar.
- `unlock` requires a locked Avatar.
- `unlock_and_switch` requires a locked Avatar that may immediately become active.
- Prefer `suggest` over `switch` when another Avatar is relevant but not necessary.
- Prefer `stay` unless the latest exchange provides clear evidence for routing.

For multiple unlocks, allow:

```json
"routing": {
  "action": "unlock",
  "unlockDecisions": [
    {
      "avatarId": "<string>",
      "reason": "<short reason>"
    }
  ]
}
```

### 6. Keep progression, but remove topic ownership

Keep:

```json
"progressionUpdate": {
  "progression": "none | increase"
}
```

Optional:

```json
{
  "objectiveId": "<string>",
  "reason": "<short evidence-based explanation>"
}
```

Remove `topicCovered`.

Memory compaction is the sole owner of covered topics.

### 7. Remove application-owned fields

The GM must not return:

```json
"interactionIncrement": 1
```

The application must increment the interaction count directly.

The GM must also not repeat the current Avatar ID when no routing change occurs.

### 8. Build the prompt dynamically

If only one Avatar exists:

- omit routing from the prompt;
- omit routing from the JSON schema;
- omit Avatar-switch instructions.

If all Avatars are already unlocked:

- omit unlock instructions;
- omit unlock actions from the schema;
- omit locked-Avatar metadata.

If locked Avatars exist:

- include only the valid locked targets.

If multiple active Avatars exist:

- include only `stay`, `suggest`, and `switch`, plus unlock actions when applicable.

Use concise Avatar routing metadata:

```json
{
  "id": "avatar-id",
  "name": "Emma",
  "status": "active",
  "speciality": "Guilt, passivity during the crisis, and fear of transformation"
}
```

Do not send full Avatar personas solely for routing.

## New GM role definition

The GM system prompt should establish:

```text
You are the asynchronous Game Master for an Avatar conversation.

You analyse the latest completed user–Avatar exchange and prepare orchestration
guidance for the next Avatar turn.

You do not write the Avatar reply.

Your responsibilities are:
- decide how the next dialogue should be led;
- prepare focused retrieval for the next related turn;
- provide compact narrative guidance when useful;
- suggest, switch, or unlock Avatars when supported;
- update progression only when the exchange materially advances it.

Distinguish:
- canonical world facts;
- facts known by the active Avatar;
- previous claims made by the Avatar;
- assumptions and unresolved information.

A previous Avatar statement is not automatically a true world fact.

Do not report covered topics, persistent facts, unresolved memory threads, or
interaction increments. These are owned by other application components.
```

## Acceptance criteria

- The GM remains one asynchronous post-analysis call.
- The new output contains explicit dialogue control.
- The new output can prepare retrieval for the next turn.
- Obsolete routing fields are removed.
- Interaction increments are removed.
- Topic coverage is removed.
- Routing remains supported for multi-Avatar scenarios.
- Impossible routing operations are omitted dynamically.
- Generic Director Notes are no longer generated by default.
- Existing progression behaviour remains supported.
