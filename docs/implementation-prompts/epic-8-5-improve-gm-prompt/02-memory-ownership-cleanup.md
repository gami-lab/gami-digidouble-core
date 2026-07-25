# Prompt 3 — Clarify Memory Compaction Ownership

## Objective

Make memory compaction the single owner of persistent conversational memory and remove overlapping responsibilities from the Game Master.

The memory compactor must own:

```text
summary
coveredTopics
unresolvedThreads
candidateFacts
```

The Game Master must not update these values.

## 1. Remove GM topic updates

Remove from the GM contract, persistence model, and merge logic:

```json
"topicCovered": "..."
```

Remove any code that merges GM topic updates into working memory.

`coveredTopics` must only come from memory compaction.

## 2. Remove GM persistent-fact ownership

The GM must not create or update:

- persistent user facts;
- character facts;
- conversation facts;
- unresolved memory threads;
- summary content.

The GM may identify retrieval needs, but retrieval needs are not persistent facts.

## 3. Prevent Avatar hallucinations from becoming memory facts

The memory compactor currently receives both user and Avatar messages.

An Avatar statement must be treated as a conversational claim, not automatically as canonical truth.

Add the following rules to the memory-compaction prompt:

```text
- Treat Avatar statements as conversational claims, not automatically as
  canonical facts.

- Do not persist an Avatar claim as a candidateFact when the user challenges it,
  when another recent message contradicts it, or when the conversation does not
  independently verify it.

- When the user identifies a contradiction and no verified resolution is
  supplied, preserve the issue as an unresolvedThread.

- A later Avatar correction may replace earlier wording in the conversation
  summary, but it must not automatically become a persistent objective fact.

- Persist a candidateFact only when it is supported by:
  - an explicit user statement;
  - verified canonical context supplied to the compactor;
  - an application-provided confirmed fact;
  - or an unchallenged stable conversational fact that is safe to retain.

- When factual status remains uncertain, preserve the uncertainty instead of
  selecting the most recent claim as truth.

- Do not convert model-generated explanations for errors into character facts.
  For example, “my memories are confused” must not become a persistent character
  condition unless the scenario explicitly establishes it.
```

## 4. Preserve provenance when available

If the memory compactor receives canonical or retrieved facts, clearly label them in the input.

Example:

```text
## VERIFIED CONTEXT
- Mona did not travel to the chalet.
- Mona initially stayed with her grandfather.
- Max later learned that the grandfather sent Mona to a quarantine camp.
```

The compactor may use verified context to resolve contradictions.

Do not require the compactor to infer which retrieved passages are authoritative from raw conversation alone.

## 5. Expected output for the Mona contradiction

For a conversation where the Avatar gave contradictory answers and no verified context is supplied, the expected result should be conceptually similar to:

```json
{
  "summary": "Julien is testing Max's recollection of the chalet events. Max said Emma, Léo and Ava travelled with him. He then gave contradictory accounts of Mona's location and later said she stayed with her grandfather. Mona's current confirmed location remains unresolved.",
  "coveredTopics": ["family members who travelled to the chalet", "Mona's absence from the chalet"],
  "unresolvedThreads": ["Clarify Mona's current confirmed location and what Max knows about it."],
  "candidateFacts": []
}
```

The compactor must not generate:

```json
{
  "category": "context",
  "key": "mona_current_location",
  "value": "with grandfather"
}
```

unless this is independently verified.

## 6. Keep interaction counts in application code

The memory compactor and GM must not increment interaction counts.

The application must increment the count deterministically after each completed exchange.

## 7. Migration and compatibility

Update any persisted GM state or working-memory models that still include:

```text
topicCovered
interactionIncrement
activeAvatarId from GM state
```

Ensure old records can still be read during migration.

When old GM outputs are loaded:

- ignore `topicCovered`;
- ignore `interactionIncrement`;
- map valid old routing fields when possible;
- default to no routing change when conversion is ambiguous.

## Acceptance criteria

- Memory compaction is the sole source of summary, covered topics, unresolved threads, and candidate facts.
- GM topic updates are removed.
- Contradicted Avatar claims do not become persistent facts.
- Unresolved factual contradictions remain visible in `unresolvedThreads`.
- Verified context may resolve a contradiction.
- Interaction counts are updated only by application code.
- Existing stored memory remains readable after migration.
