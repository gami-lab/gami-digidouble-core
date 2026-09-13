# Game Master contract

The Game Master (GM) is the asynchronous director of an experience. It observes completed Avatar
turns and prepares safe guidance for future turns. It never blocks the normal Avatar response.

## Non-negotiables

- Run after a completed Avatar turn, on session start when configured, or by explicit admin replay.
- Do not run post-turn GM work after an interrupted stream or failed Avatar completion.
- Keep routing/lifecycle ownership in the session/conversation application use cases.
- Treat model output as untrusted. Parse a strict current shape, validate all references, and ignore invalid actions safely.
- Persist bounded current orchestration state and safe diagnostics; never persist raw prompts, raw model output, or user text in events.
- Keep static retrieved context separate from conversational memory.

## Runtime inputs

GM input is a bounded projection of:

- scenario language, goals, rules, and active Avatar roster
- session active Avatar, available/unlocked Avatars, and transition state
- the completed turn and bounded conversation state
- working/episodic/user memory projections
- scenario knowledge retrieval, with explicit unrestricted visibility for GM when needed
- pending guidance from the previous GM turn, consumed at most once

The exact input DTO and prompt rendering are code-owned. The contract is the ownership and safety
boundary, not a template to copy into another layer.

## Runtime output

The current output contains only structured, validated decisions:

- director notes for the next Avatar turn
- progression update
- optional dialogue-control guidance
- optional next-turn retrieval queries and required facts
- optional routing proposal and unlock proposal
- bounded orchestration state update

The parser rejects missing required current fields and obsolete/legacy shapes. Empty or invalid
proposals are ignored or reduced to a safe `stay` outcome; they cannot mutate lifecycle state.

## Routing and progression

- A GM routing proposal may update the session’s next active Avatar after validation.
- It does not create, close, or switch a conversation by itself.
- Repeating the current Avatar is not a switch.
- The explicit session switch use case owns conversation handoff and emits the canonical transition.
- Completed exchange count is incremented by application code exactly once, not by GM success/failure.

## Retrieval guidance

GM retrieval is forward-looking: it may prepare evidence for the likely next subject, exact questions,
contradictions, or knowledge-boundary issues. Planned retrieval is consumed only when relevant to the
next Avatar turn; stale or unrelated plans are suppressed. Required gaps become explicit uncertainty
guidance instead of fabricated certainty.

## Diagnostics

Record event type, outcome, latency, effective model, bounded validation/failure codes, and safe
retrieval/context metadata. Do not emit prompts, user messages, secrets, raw model responses, vectors,
or unbounded document content.

## Ownership

The GM owns planning and structured guidance. Conversation owns lifecycle. Memory owns compaction and
fact promotion. Knowledge owns static retrieval. Operations owns replay and inspection. API/shared
types own public projections.
