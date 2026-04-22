# 05 — Documentation Sync

## Context

Implementation is complete. This prompt ensures that every affected document is updated to match the new reality. Code that ships without documentation sync is not done.

## Scope

**In scope:**

- `docs/API_CONTRACT.md` — add `GET /v1/admin/health` contract
- `docs/PROJECT_STATUS.md` — mark EPIC 3.1 complete, update module list and sprint table
- `docs/ARCHITECTURE.md` — verify infrastructure/health module is reflected
- `docs/TECH_STACK.md` — confirm ioredis is listed if it was added in prompt 02
- `docs/TEST_STRATEGY.md` — verify probe unit test and stack E2E patterns are described

**Out of scope:**

- Any code changes
- Writing new features

## Relevant Docs

All docs in `docs/`.

## Implementation Guidance

### `docs/API_CONTRACT.md`

Add a new section for `GET /v1/admin/health` after the existing endpoints. Include:

**Request:**

```
GET /v1/admin/health
x-api-key: <API_KEY>
```

**Response (always 200):**

```json
{
  "data": {
    "status": "healthy | degraded",
    "checkedAt": "<ISO 8601 UTC>",
    "dependencies": [
      {
        "name": "postgres | redis | llm",
        "status": "healthy | degraded | unknown",
        "latencyMs": <number | null>,
        "message": "<string, only when degraded>"
      }
    ]
  },
  "error": null
}
```

**HTTP status:** always `200`. The `data.status` field is the health signal.

**Auth:** API key required. Missing or wrong key → `401 UNAUTHORIZED`.

**Notes:**

- Overall `status` is `'healthy'` only when all dependency probes return `'healthy'`
- Individual probe failures do not affect HTTP status — they appear in `dependencies[].status`
- `latencyMs` is the round-trip time of the probe call in milliseconds

### `docs/PROJECT_STATUS.md`

1. Update the Sprint 3 table (mapped in the file as "Sprint O" or wherever EPIC 3.1 currently sits):
   - Change EPIC 3.1 status from `Not started` to `Complete`
   - Add a short note: "Rich `/v1/admin/health` probe with Postgres, Redis, and LLM dependency checks"

2. Add to **Implemented Modules**:
   - `Admin health endpoint (GET /v1/admin/health)` — per-dependency probes with `healthy/degraded` status

3. Update the "Known Issues / Blockers" section if the "No dependency health probe" bullet was listed there — remove it or mark it resolved.

4. Update the **Last updated** field to today's date.

### `docs/ARCHITECTURE.md`

Verify the module map in `ARCHITECTURE.md` includes `infrastructure/health/`. If the module map lists explicit subdirectories, add:

```
infrastructure/
  health/     → Postgres, Redis, and LLM dependency probes
```

If the file does not list individual subdirectories at this level, no change is needed — just confirm it is still accurate.

### `docs/TECH_STACK.md`

If `ioredis` was installed as part of prompt 02, find the Redis section and update it to confirm `ioredis` is the provisioned client library in use.

### `docs/TEST_STRATEGY.md`

Review the integration/E2E sections. Verify that:

- Probe unit tests are covered under the "unit test" category description
- Stack E2E pattern for admin routes is mentioned (or add a brief note)

If the file is already accurate, explicitly state in the commit message that you verified it.

## Constraints

- No code changes — documentation only
- Docs must accurately reflect what was built, not aspirational descriptions
- All endpoint contracts in `API_CONTRACT.md` must follow the existing format/style

## Deliverables

- `docs/API_CONTRACT.md` — updated with `GET /v1/admin/health` contract
- `docs/PROJECT_STATUS.md` — EPIC 3.1 marked complete, module list updated
- `docs/ARCHITECTURE.md` — module map verified/updated
- `docs/TECH_STACK.md` — ioredis confirmed if added
- `docs/TEST_STRATEGY.md` — verified accurate

## Mandatory Final Step — Documentation Update

This entire prompt IS the documentation update step. After completing it:

- Commit with message: `docs(epic-3.1): sync API_CONTRACT, PROJECT_STATUS, ARCHITECTURE after health endpoint`
- Run `pnpm lint` to confirm no markdown lint issues if configured

## Acceptance Criteria

- [ ] `docs/API_CONTRACT.md` has a complete `GET /v1/admin/health` section with request, response, auth, and notes
- [ ] `docs/PROJECT_STATUS.md` shows EPIC 3.1 as complete with a meaningful note
- [ ] `docs/PROJECT_STATUS.md` "Known Issues" section no longer lists "No dependency health probe" as an open gap
- [ ] `docs/ARCHITECTURE.md` module map is accurate
- [ ] `docs/TECH_STACK.md` is accurate with respect to Redis client library
- [ ] No doc refers to migration runner or migrations directory (those were removed in a prior fix)
- [ ] All quality gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`
