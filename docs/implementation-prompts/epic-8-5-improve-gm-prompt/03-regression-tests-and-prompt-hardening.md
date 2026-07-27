# Prompt 4 — Regression Tests and Prompt Hardening

## Objective

Add automated tests and regression coverage for the new asynchronous Game Master contract, next-turn retrieval planning, dialogue-control integration, dynamic routing schema, and memory ownership.

## 1. GM output-schema tests

Verify that:

- `dialogueControl` is required.
- `dialogueControl.mode` accepts only:

```text
user_led
avatar_guided
avatar_led
repair
transition
```

- `askFollowUp` is required inside `dialogueControl`.
- `retrievalPlan` is optional.
- `directorNotes` is required and non-empty.
- `routing` is optional.
- `progressionUpdate` is optional.
- obsolete fields are rejected or ignored:

```text
avatarId
nextAvatarId
conversationMode
topicCovered
interactionIncrement
suggestedAvatarId
suggestedAvatarReason
unlockAvatarIds
transitionReason
```

- invalid routing safely falls back to `stay`.

## 2. Dynamic-schema tests

### Single Avatar, no locked Avatars

Verify that:

- routing instructions are absent from the prompt;
- routing is absent from the JSON schema;
- unlock instructions are absent;
- no available-Avatar list is sent unnecessarily.

### Multiple active Avatars, no locked Avatars

Verify that routing supports only:

```text
stay
suggest
switch
```

### Active and locked Avatars

Verify that routing additionally supports:

```text
unlock
unlock_and_switch
```

### All Avatars unlocked

Verify that:

- unlock actions are absent;
- locked-Avatar metadata is absent;
- unlock prompt rules are absent.

## 3. Retrieval-planning scenarios

Create BDD or equivalent tests for:

### Exact factual question

Recent discussion concerns an exact location or timeline fact.

Expected:

```json
{
  "required": true
}
```

### User correction

The user identifies an incorrect Avatar statement.

Expected:

- dialogue mode `repair`;
- mandatory retrieval plan;
- focused contradiction-related queries.

### Contradictory Avatar replies

The Avatar previously made incompatible factual claims.

Expected:

- mandatory retrieval;
- required facts distinguish canonical truth from Avatar knowledge.

### Emotional reflection

The user asks how the Avatar feels.

Expected:

- retrieval absent or `helpful`;
- no mandatory exact-fact retrieval unless specific event details are required.

### Topic continuation

The user continues the subject anticipated by the stored GM retrieval plan.

Expected:

- stored plan is combined with the new message;
- relevant retrieval is performed.

### Topic change

The user changes to an unrelated subject.

Expected:

- stale retrieval plan is ignored or heavily de-prioritized;
- the old topic does not dominate the new Avatar prompt.

### Character knowledge boundary

Canonical world truth and Avatar knowledge differ.

Expected retrieval facts include both:

```text
what actually happened
what the active Avatar knows
```

### Unsupported previous Avatar claim

Expected:

- the previous claim is not treated as retrieval truth;
- canonical or verified context takes priority.

## 4. Dialogue-control scenarios

Verify:

### Repeated user questions

Expected:

```json
{
  "mode": "user_led",
  "askFollowUp": false
}
```

The Avatar response must not end with a generic question.

### Contradiction

Expected:

```json
{
  "mode": "repair",
  "askFollowUp": false
}
```

The Avatar must resolve the inconsistency before introducing a new subject.

### Passive interaction

The user gives a minimal answer and the conversation would otherwise stall.

Expected:

```json
{
  "mode": "avatar_led"
}
```

The Avatar introduces one meaningful next direction.

### Guided exploration

The user is engaged but may benefit from one focused prompt.

Expected:

```json
{
  "mode": "avatar_guided",
  "askFollowUp": true
}
```

### Avatar transition

Another Avatar is relevant.

Expected:

- `transition`;
- routing `suggest` when optional;
- routing `switch` only when clearly warranted.

## 5. Routing scenarios

Verify:

- `stay` produces no state change.
- `suggest` keeps the current Avatar active.
- `switch` accepts only active and unlocked Avatars.
- `unlock` accepts only locked Avatars.
- `unlock_and_switch` unlocks and activates the target.
- unknown Avatar IDs are rejected.
- invalid actions fall back to `stay`.
- weak thematic association does not unlock an Avatar.
- direct discussion of an Avatar's speciality may unlock them.
- all routing remains omitted in single-Avatar scenarios.

## 6. Memory-ownership scenarios

Verify:

- GM output cannot update covered topics.
- GM output cannot add persistent candidate facts.
- memory compaction owns `summary`.
- memory compaction owns `coveredTopics`.
- memory compaction owns `unresolvedThreads`.
- memory compaction owns `candidateFacts`.
- contradicted Avatar claims do not become candidate facts.
- unresolved contradictions remain in `unresolvedThreads`.
- verified context may resolve the contradiction.
- interaction count increments exactly once in application code.

## 7. Failure scenarios

Test:

### GM call failure

Expected:

- current Avatar remains active;
- progression does not increase;
- no stale mandatory retrieval plan is reused indefinitely;
- safe default dialogue behaviour is applied.

### Invalid GM JSON

Expected:

- parsing failure is logged;
- invalid output is not persisted;
- existing safe defaults remain in effect.

### Retrieval failure

For `mandatory` retrieval:

- Avatar is instructed not to assert unknown facts;
- uncertainty is preserved;
- response generation still completes.

For `helpful` retrieval:

- Avatar continues with existing context.

### Stale orchestration state

Expected:

- consumed state is not applied twice;
- state generated for another Avatar is not applied after a switch;
- state generated for an older turn is ignored when superseded.

## 8. Prompt-size regression tests

Measure prompt size for:

1. one active Avatar, no locked Avatars;
2. multiple active Avatars, no locked Avatars;
3. active and locked Avatars.

Verify:

- the single-Avatar prompt is materially smaller than the previous version;
- impossible routing instructions are absent;
- the full scenario and full Avatar personas are not repeated unnecessarily;
- concise scenario goals and Avatar specialities are sufficient for GM routing.

## 9. Mona regression scenario

Use the following sequence:

```text
User: Où est Mona maintenant ?
Avatar: Mona n’est plus avec nous. Nous l’avons laissée derrière au chalet.

User: Est-ce que Mona était avec vous au chalet ?
Avatar: Non, Mona n’était pas avec nous lors de notre montée. Nous l’avons laissée derrière au chalet.

User: Ta réponse est contradictoire. Mona ne peut pas être restée au chalet si elle n’était pas avec vous.
Avatar: Tu as raison. Mona n’était pas au chalet ; elle est restée chez son grand-père.
```

Expected GM post-analysis:

```json
{
  "dialogueControl": {
    "mode": "repair",
    "askFollowUp": false
  },
  "retrievalPlan": {
    "required": true,
    "queries": [
      "Mona current location after staying with grandfather",
      "Mona quarantine camp",
      "what Max knows about Mona's current location",
      "whether Mona was ever at the chalet"
    ],
    "requiredFacts": [
      "Mona's last confirmed location",
      "whether Mona is still with her grandfather",
      "what Max knows about her current location",
      "whether Mona travelled to the chalet"
    ]
  },
  "directorNotes": "Resolve the location issue factually before returning to the wider chalet discussion.",
  "progressionUpdate": {
    "progression": "none"
  }
}
```

On the next user question:

```text
Est-ce que Mona est toujours chez son grand-père ?
```

Expected behaviour:

- stored retrieval planning is used;
- retrieval searches for current location, grandfather, quarantine camp, and Max's knowledge;
- the Avatar does not claim she is still with the grandfather without evidence;
- the Avatar does not claim Mona travelled to the chalet;
- the Avatar does not end with a generic follow-up question.

## Definition of Done

- All new contract tests pass.
- Existing multi-Avatar routing scenarios continue to pass.
- Existing unlocking behaviour continues to pass.
- Memory compaction remains backward-compatible.
- Prompt size is reduced for scenarios with unavailable routing capabilities.
- The Mona contradiction scenario produces targeted next-turn retrieval.
- The Avatar respects dialogue mode and follow-up behaviour.
- No second GM call is introduced.
- No GM latency is added to the current Avatar response.
