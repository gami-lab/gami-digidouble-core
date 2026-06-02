# Murder Party API Setup Gaps And Proposals

This note lists API and platform gaps observed while implementing full murder-party setup through HTTP only.

## 1. No knowledge source update endpoint

Current API supports:

- `POST /v1/knowledge-sources`
- `GET /v1/scenarios/{scenarioId}/knowledge-sources`
- ingestion endpoints

Missing:

- update source metadata/content
- update source visibility
- delete source

### Impact

Bootstrap scripts can create sources, but cannot replace changed content in-place.
If a source was created with outdated content, the script must either:

- keep the stale source
- create duplicate sources

### Proposal

Add:

- `PATCH /v1/knowledge-sources/{sourceId}`
- `DELETE /v1/knowledge-sources/{sourceId}`

Suggested request shape for PATCH:

```ts
type UpdateKnowledgeSourceRequest = {
  name?: string
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
  uriOrPath?: string
}
```

Suggested behavior:

- when fields affecting ingestion inputs change (`metadata`, `uriOrPath`, maybe `format`), set status back to `pending`
- ingestion must be explicitly re-triggered

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

## 3. Source loading is currently inline-text centric

The current content loader implementation (`InMemoryKnowledgeSourceContentLoader`) resolves content from:

- `metadata.inlineText`
- fallback string built from `uriOrPath`

It does not perform real remote/local fetch of PDF/text/markdown/url assets.

### Impact

`uriOrPath` and `format` are accepted by API, but ingestion does not yet parse real files/URLs by default runtime adapter.

### Proposal

Introduce a production loader adapter, for example:

- `FileUrlKnowledgeSourceContentLoader`

Responsibilities:

- fetch `url` sources over HTTP(S)
- read configured local or mounted files (for `text`/`markdown`/`pdf`) with allowlisted roots
- extract text from PDF sources
- produce normalized text content and metadata

Maintain `InMemoryKnowledgeSourceContentLoader` as the fallback for tests and controlled bootstrap flows.

## 4. No direct endpoint to test avatar-visible retrieval in runtime path

The admin retrieval endpoint supports `activeAvatarId` and works well for diagnostics.
There is no dedicated non-admin retrieval introspection endpoint for regular operator flows.

### Impact

Visibility debugging in production relies on admin endpoint access.

### Proposal

Optional: add a bounded operator endpoint under authenticated admin scope with clearer diagnostics for avatar visibility checks, or surface retrieval diagnostics in runtime inspector endpoints where appropriate.
