# Conversation Evaluation Foundation

This package is the standalone local foundation for EPIC 8.6 scripted conversation evaluation.
It owns evaluation definitions and reports, while Core HTTP DTOs remain owned by `@gami/shared`.
The current CLI only validates a definition and resolves configuration; later slices add the
network runner and judge without changing the definition contract.

## Definition format

Definitions are versioned JSON files. The v1 shape is:

```json
{
  "version": 1,
  "name": "Villa baseline",
  "scenarioId": "scenario_villa_miralac",
  "initialAvatarName": "Clara Whitcombe",
  "model": "openai/gpt-5.4",
  "judgeModel": "openai/gpt-5.4-mini",
  "questions": [
    {
      "question": "What happened in the winter garden?",
      "expectedResponse": "Mention the death and storm; wording may differ."
    }
  ]
}
```

Use exactly one of `initialAvatarId` or `initialAvatarName`. Exact duplicate question text is
rejected. `expectedResponse` is criteria text for a later semantic judge, not an exact-match
answer. `model` and `judgeModel` are declared/expected metadata for comparison and verification;
they never override Core's server-side model resolution. API keys and other secrets are not valid
definition fields.

## Configuration and validation command

Run the foundation command from the repository root:

```sh
pnpm --filter @gami/conversation-evaluation evaluate -- \
  --definition ./path/to/definition.json \
  --avatar-api-base-url http://localhost:3000 \
  --api-key "$API_KEY"
```

The command makes no network requests. It validates the JSON first, then prints a safe run plan.
The API key is accepted only through `--api-key`, `EVALUATION_API_KEY`, or `API_KEY` and is never
printed. Other options can be supplied by flag or environment variable:

| Option                  | Environment                       | Default                  |
| ----------------------- | --------------------------------- | ------------------------ |
| `--definition`          | `EVALUATION_DEFINITION_PATH`      | required                 |
| `--avatar-api-base-url` | `AVATAR_API_BASE_URL`             | required                 |
| `--api-key`             | `EVALUATION_API_KEY` or `API_KEY` | required                 |
| `--judge-base-url`      | `JUDGE_API_BASE_URL`              | omitted                  |
| `--output`              | `EVALUATION_OUTPUT_PATH`          | `evaluation-report.json` |
| `--timeout-ms`          | `EVALUATION_TIMEOUT_MS`           | `30000`                  |
| `--user-id`             | `EVALUATION_USER_ID`              | unique run-scoped ID     |

The generated user ID prevents repeated runs from unintentionally sharing memory. Set
`--user-id` when deliberately testing continuity across runs. Output/report writing is reserved
for the runner slice; the path is resolved now so later prompts can use the same foundation API.

The package API exposes `validateTestDefinition`, `loadTestDefinition`, `loadEvaluationConfig`, and
the tool-owned report types from `src/index.ts`. It has no Core-internal, database, Redis, Langfuse,
provider SDK, YAML, or HTTP client dependency.
