# Gami DigiDouble — Debug Console

A browser UI for understanding how Core uses LLMs: what each call was given, what it decided, how
long it took, and what changed in memory. It reads Core's admin and public routes only; authoring
(scenarios, avatars, knowledge sources, model configuration) lives in `apps/admin`.

## What it shows

- **Scenario → Avatar preparation** — authored persona input and the prepared traits every Avatar
  prompt is built from; re-run trait preparation.
- **Scenario → Knowledge & RAG** — a retrieval bench (query, visibility, per-type limit) with
  queries, timings, candidates, and similarity; sources with ingestion status and chunks.
- **Session → Turns** — a live timeline of turns and background work. Each turn opens to:
  latency breakdown (speech-to-text, retrieval, LLM first token/generation, overhead), what the
  Avatar was given (director note, traits, persona, recent exchanges, working/episodic memory,
  facts), the RAG result, the GM decision that followed, and memory updates. A text composer drives
  extra turns; voice turns come from the web app and appear live.
- **Session → Memory now / Next-turn context** — current memory layers with update history, and a
  dry run of the next turn's context with token-budget decisions.

Rendered prompts and raw responses stay in Langfuse; every LLM call links to its trace.

## Setup

```bash
cp apps/console/.env.example apps/console/.env
pnpm --filter @gami/console dev
```

| Variable                    | Required | Description                                                         |
| --------------------------- | -------- | ------------------------------------------------------------------- |
| `VITE_API_URL`              | No       | Core API base URL (default `http://localhost:3000`)                 |
| `VITE_API_KEY`              | Yes      | API key sent as `x-api-key`                                         |
| `VITE_LANGFUSE_PROJECT_URL` | No       | e.g. `https://cloud.langfuse.com/project/<id>`; enables trace links |

Core must allow the console origin (`CORS_ORIGIN`).

## URLs

Every view is addressable, so reload and shared links reopen the same debug target:

- `/` — scenarios
- `/scenarios/:scenarioId[/avatars|/knowledge]`
- `/sessions/:sessionId[/memory|/context]` and `/sessions/:sessionId?turn=:correlationId`
