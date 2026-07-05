# Murder Party API Setup Gaps And Proposals

This note lists API and platform gaps observed while implementing full murder-party setup through HTTP only.

## 1. No knowledge source update endpoint — RESOLVED

Current API supports:

- `POST /v1/knowledge-sources`
- `PATCH /v1/knowledge-sources/{sourceId}`
- `DELETE /v1/knowledge-sources/{sourceId}`
- `GET /v1/scenarios/{scenarioId}/knowledge-sources`
- ingestion endpoints

Implemented request shape for PATCH (`apps/core/src/api/routes/knowledge.ts`,
`packages/shared/src/knowledge-contract-types.ts`):

```ts
type UpdateKnowledgeSourceRequest = {
  name?: string
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
  uriOrPath?: string
}
```

Behavior:

- at least one field must be provided (400 `VALIDATION_ERROR` otherwise)
- when `metadata` or `uriOrPath` changes, status is reset to `pending`; ingestion must be
  explicitly re-triggered via `POST /v1/knowledge-sources/{sourceId}/ingest`
- `DELETE` removes the source and its chunks (`IKnowledgeChunkRepository.deleteBySourceId`);
  Postgres also cascades ingestion job rows via `ON DELETE CASCADE`

The murder-party bootstrap script (`setup-via-api.ts`) now calls `updateKnowledgeSource`
in-place when it detects content hash drift, instead of only warning.

## 2. No scenario lookup by deterministic external key

Current setup script must call `GET /v1/scenarios` and match by `name` or config metadata.

### Impact

Name-based matching is fragile for idempotent automation in shared environments.

### Proposal

Add one deterministic lookup endpoint:

- `GET /v1/scenarios/by-key/{seedKey}`

Or support query filtering:

- `GET /v1/scenarios?externalKey=murder-party-villa-miralac`

With scenario create/update contract extension:

```ts
type ScenarioConfig = {
  externalKey?: string
  // existing fields
}
```

## 3. Source loading is currently inline-text centric — RESOLVED

`FileUrlKnowledgeSourceContentLoader` (`apps/core/src/infrastructure/knowledge/file-url-knowledge-source-content-loader.ts`)
is now the production content loader, wired in `src/index.ts`:

- `metadata.inlineText` is still honored first, when present, for environment-portable bootstrap flows
- `format: 'url'` sources are fetched over HTTP(S)
- `format: 'text' | 'markdown'` sources are fetched over HTTP(S) when `uriOrPath` is a URL, otherwise read
  from local/mounted disk — gated by an explicit `allowedRoots` allowlist (empty by default, i.e. local
  file access is disabled unless configured)
- `format: 'pdf'` sources are fetched/read the same way and parsed via `pdf-parse`
- `format: 'media'` sources still produce a description/reference string (no binary transcription)
- a `maxContentBytes` guard (10 MB default) bounds fetched/read content size

Configuration: `KNOWLEDGE_SOURCE_ALLOWED_ROOTS` (comma-separated absolute paths), see `.env.example`.

`InMemoryKnowledgeSourceContentLoader` remains the default in `src/api/server.ts` for tests and
route-level unit tests that don't provide adapters explicitly.

## 4. No direct endpoint to test avatar-visible retrieval in runtime path

The admin retrieval endpoint supports `activeAvatarId` and works well for diagnostics.
There is no dedicated non-admin retrieval introspection endpoint for regular operator flows.

### Impact

Visibility debugging in production relies on admin endpoint access.

### Proposal

Optional: add a bounded operator endpoint under authenticated admin scope with clearer diagnostics for avatar visibility checks, or surface retrieval diagnostics in runtime inspector endpoints where appropriate.
