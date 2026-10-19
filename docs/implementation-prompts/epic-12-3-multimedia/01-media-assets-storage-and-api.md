# Title

Add Media Assets, File Storage, And The Media API

# Context

Scenarios need a catalogue of images and videos that slots, triggers, and GM cues can reference.
There is no file storage in Core today. This slice adds the entity, persistence, a storage port with
a filesystem adapter, admin CRUD/upload routes, and the open delivery route the player's `<img>` and
`<video>` elements load from.

# Scope

Implement now:

- domain `MediaAsset`: id, scenarioId, kind, source (`upload` | `url`), storage key or URL, MIME
  type, byte size, optional poster `MediaRef`, optional `durationMs`, description, `cueable` flag,
  timestamps; typed failures for unknown asset, wrong scenario, unsupported type, too large
- `IMediaAssetRepository` with PostgreSQL and in-memory adapters; scenario delete cascades
- `IMediaStorage` port (put stream, open read stream with range, delete) with a filesystem adapter
  rooted at a configured directory, and an in-memory adapter for tests
- admin routes (tier `admin`):
  - `GET /v1/admin/scenarios/{scenarioId}/media`
  - `POST /v1/admin/scenarios/{scenarioId}/media` (URL asset, JSON)
  - `POST /v1/admin/scenarios/{scenarioId}/media/upload` (raw binary body with `Content-Type`,
    metadata in headers or query, following the `voice-messages` raw-body pattern)
  - `PATCH|DELETE /v1/admin/media/{assetId}`
- open route `GET /v1/media/{assetId}`: only assets of active scenarios; `Range`/`206`, `ETag`,
  `Cache-Control`, `Content-Type` from the stored MIME; URL assets return `302` to the URL or are
  resolved by the projection directly (choose one and document it); unknown → 404
- reference validation: saving presentation refs (from `00`) to a missing or foreign-scenario asset
  → `400 VALIDATION_ERROR`; deleting an asset that is referenced → `409 CONFLICT`
- compose: a named volume for the media directory on the Core service; config for path and limits

Out of scope:

- admin UI (prompt `02`), runtime triggers and events (prompts `03`, `04`), transcoding,
  thumbnail generation, server-side duration probing (the admin client supplies duration/poster)

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TECH_STACK.md`
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`

# Implementation Guidance

- Use the 12.1 route-tier declaration on every new route; the tier matrix test must cover them.
- Upload: stream the request body to storage; do not buffer whole videos in memory. Set the
  route-specific body limit from the shared constants. Verify the declared MIME against magic
  bytes for the allowed types (JPEG, PNG, WebP, MP4, WebM) without adding a dependency if a few
  byte checks suffice.
- Storage keys are Core-generated (asset id based), never derived from client filenames.
- Deploys recreate the database; decide how the media volume is handled on deploy (wiped with the
  DB, or orphaned files tolerated) by checking the current deploy procedure, and document it.
- Required stack-e2e files: `admin-media.stack-e2e.test.ts` (401 without admin credential, 403 with
  a player token, 400 on invalid metadata/oversized/unsupported type, 404 on unknown scenario/asset,
  upload success) and `media-file.stack-e2e.test.ts` (404 unknown, 404 asset of inactive scenario,
  200 and 206 with `Range`).
- Integration tests for the PostgreSQL repository and filesystem adapter (temp dir).

# Constraints

- No new datastore; files on a mounted volume behind a port.
- Never log file contents; bounded diagnostics (asset id, size, MIME, duration of the operation).
- Admin projections are bounded; public projection exposes only `PublicMediaAsset` fields.

# Deliverables

- entity, repository (PostgreSQL + in-memory), storage port + filesystem/in-memory adapters
- admin media routes, open file route, reference validation
- schema change, compose volume, config and `.env.example` names
- unit, integration, route, and stack-e2e tests

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (MediaAsset, Scenario, presentation refs, config).
2. Search for duplicated type definitions and existing raw-body/upload helpers to reuse.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/DATA_MODEL.md` (media table, storage keys, cascade, volume)
- `docs/API_CONTRACT.md` (admin media routes, open file route, Range/caching rules)
- `docs/ARCHITECTURE.md` (storage port)
- `docs/TECH_STACK.md` (volume, config)
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Admin can create URL assets and upload image/video assets within limits.
- [ ] The open route serves only active-scenario assets with Range support.
- [ ] Referenced assets cannot be deleted; refs to missing assets are rejected.
- [ ] Large uploads stream without buffering the whole file.
- [ ] Stack-e2e covers auth, tier, validation, not-found, and success.
- [ ] Documentation reviewed and updated.
