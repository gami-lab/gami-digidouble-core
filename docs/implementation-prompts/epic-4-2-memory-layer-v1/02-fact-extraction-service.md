# Prompt 02 — User Fact Extraction Service

## Context

User facts are extracted from conversation transcripts when a conversation is closed. The
extraction is LLM-driven: the system sends the conversation history and asks the model to
identify durable facts about the user (preferences, role, constraints, goals).

Extraction is always asynchronous and non-blocking — it runs after conversation close, in the
same fire-and-forget pattern as `MessageHistoryCompactionService`.

This prompt adds the extraction port, its LLM implementation, and wires it into
`EndConversationUseCase` alongside the existing compaction trigger.

## Scope

**In scope:**

- `IUserFactExtractor` application port
- `LlmUserFactExtractor` infrastructure implementation (wraps `ILlmAdapter`)
- Wire extraction into `EndConversationUseCase` (non-blocking, after compaction)
- Unit tests for `LlmUserFactExtractor` (mocked LLM) and the wiring in `EndConversationUseCase`

**Out of scope:**

- Retrieval / injection into avatar context (Prompt 03)
- API endpoints (Prompt 04)

---

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` §2 — KISS/YAGNI principle; extraction must be minimal
- `docs/DATA_MODEL.md` §10 — `UserMemoryFact` field semantics (`category`, `key`, `value`)
- `apps/core/src/application/use-cases/end-conversation/end-conversation.use-case.ts` — where
  compaction is triggered (async, non-blocking); fact extraction follows the same pattern
- `apps/core/src/application/services/message-history-compaction.service.ts` — reference for how
  a simple compaction/extraction service is structured
- `apps/core/src/infrastructure/llm/` — reference for how `ILlmAdapter` is consumed

---

## Mandatory Pre-Implementation Check

1. Confirm `IUserMemoryFactRepository` port exists (from Prompt 01).
2. Confirm `UserFact` type has `category`, `key`, `value`, `userId` fields.
3. Read `EndConversationUseCase.execute()` fully — identify `compactSessionMemory` call and
   where to add the new `extractUserFacts` call without disturbing close semantics.
4. Verify no existing `IUserFactExtractor` or `fact_extraction` event type already exists.

---

## Implementation Guidance

### Step 1 — Define `IUserFactExtractor` port

Create `apps/core/src/application/ports/IUserFactExtractor.ts`:

```ts
import type { UserFact } from '../../domain/memory/memory.types.js'

export type ExtractUserFactsInput = {
  userId: string
  conversationId: string
  messages: Array<{
    role: 'user' | 'avatar' | 'system'
    content: string
  }>
}

export type ExtractedFact = Pick<UserFact, 'category' | 'key' | 'value'> & {
  confidence?: number
}

export interface IUserFactExtractor {
  extract(input: ExtractUserFactsInput): Promise<ExtractedFact[]>
}
```

### Step 2 — Implement `LlmUserFactExtractor`

Create `apps/core/src/infrastructure/llm/llm-user-fact-extractor.ts`.

This class implements `IUserFactExtractor` and uses `ILlmAdapter` internally.

**Extraction prompt design (keep it simple):**

The system prompt must instruct the model to:

- read the conversation
- identify 0–5 durable facts about the user (not the avatar, not the scenario)
- return a JSON array of objects: `{ category, key, value, confidence? }`
- use compact, lowercase, snake_case for `key`
- use bounded `category` values: `"preference"`, `"constraint"`, `"goal"`, `"identity"`, `"context"`
- return `[]` if no durable facts are found
- never invent facts not grounded in the conversation

**Parsing:**

- Extract JSON from the LLM response content (may be wrapped in markdown code fences — strip them)
- If parsing fails, log a warning and return `[]` (never throw)
- Validate each extracted fact has `category`, `key`, `value` as non-empty strings
- Cap at 5 facts per call to prevent noise

**Constructor:**

```ts
constructor(private readonly llm: ILlmAdapter) {}
```

### Step 3 — Wire Extraction into `EndConversationUseCase`

**Add dependencies to constructor** (all optional to maintain backward compatibility with tests
that don't inject them):

```ts
constructor(
  // ... existing params ...
  private readonly userFactExtractor?: IUserFactExtractor,
  private readonly userMemoryFactRepository?: IUserMemoryFactRepository,
)
```

**Add private method `extractAndPersistUserFacts`:**

```ts
private async extractAndPersistUserFacts(
  userId: string,
  conversationId: string,
): Promise<void> {
  if (this.userFactExtractor === undefined || this.userMemoryFactRepository === undefined) return

  // load messages for this conversation
  // extract facts via LlmUserFactExtractor
  // for each extracted fact: upsert via IUserMemoryFactRepository
  // emit 'user_fact_extraction_succeeded' or 'user_fact_extraction_failed' to event log
  // never throw — log failures and return silently
}
```

**Call it non-blocking in `execute()`, after the compaction trigger:**

```ts
void this.compactSessionMemory(sessionId, conversationId)
void this.extractAndPersistUserFacts(userId, conversationId)
```

The `userId` comes from the session loaded during `execute()`. If the session lookup is not
already done before the close operation, fetch it at the start of `execute()`.

**Event log emission** (follow the existing `memory_compaction_*` pattern):

- `user_fact_extraction_triggered` — emitted synchronously before the async call
- `user_fact_extraction_succeeded` — emitted inside the async method on success, includes `factCount`
- `user_fact_extraction_failed` — emitted on error, never re-throws

### Step 4 — Unit Tests for `LlmUserFactExtractor`

Create `apps/core/src/infrastructure/llm/llm-user-fact-extractor.test.ts`.

Required test cases (mock `ILlmAdapter`):

| Test                            | Setup                                                                  | Expected                  |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------- |
| Valid JSON response             | LLM returns `[{category:"preference",key:"language",value:"English"}]` | Returns 1 fact            |
| Response in markdown code fence | LLM returns ` ```json\n[...]\n``` `                                    | Parses correctly          |
| Empty array response            | LLM returns `[]`                                                       | Returns `[]`              |
| Malformed JSON                  | LLM returns `"not json"`                                               | Returns `[]`, no throw    |
| More than 5 facts in response   | LLM returns 8 facts                                                    | Returns at most 5         |
| Missing required field          | LLM returns fact with no `key`                                         | That fact is filtered out |
| LLM throws                      | LLM adapter throws                                                     | Returns `[]`, no throw    |

### Step 5 — Unit Tests for `EndConversationUseCase` Fact Extraction Wiring

Extend `apps/core/src/application/use-cases/end-conversation/end-conversation.use-case.test.ts`:

| Test                                     | Expected                               |
| ---------------------------------------- | -------------------------------------- |
| `userFactExtractor` not injected         | no error, extraction silently skipped  |
| `userMemoryFactRepository` not injected  | same as above                          |
| both injected, extractor returns 2 facts | `upsert` called twice                  |
| extractor throws                         | use case does not throw (non-blocking) |
| upsert failure                           | use case does not throw                |

---

## Constraints

- Extraction is **fire-and-forget** — it must not delay the HTTP response
- `LlmUserFactExtractor` must never throw to its caller — all errors are caught internally
- LLM call is bounded: max input tokens should be controlled (e.g., send last 20 messages only)
- Extraction is stateless — no memory of previous extractions at this layer
- The repository `upsert` handles deduplication by `(userId, category, key)` — no dedup needed here

---

## Deliverables

- `apps/core/src/application/ports/IUserFactExtractor.ts`
- `apps/core/src/infrastructure/llm/llm-user-fact-extractor.ts`
- Updated `EndConversationUseCase` with optional fact extraction wiring
- Unit tests for `LlmUserFactExtractor`
- Updated `end-conversation.use-case.test.ts` covering extraction wiring

---

## Mandatory Final Step — Documentation Update

No new API endpoints in this prompt. Verify `docs/DATA_MODEL.md` §10 accurately describes
the extraction trigger (conversation close) and that fact extraction is async/non-blocking.

---

## Acceptance Criteria

- [ ] `IUserFactExtractor` port is defined
- [ ] `LlmUserFactExtractor` handles all LLM failure modes without throwing
- [ ] Extraction is wired non-blocking into `EndConversationUseCase`
- [ ] `user_fact_extraction_triggered/succeeded/failed` events appear in `event_log`
- [ ] `pnpm typecheck` and `pnpm test` pass with zero errors
