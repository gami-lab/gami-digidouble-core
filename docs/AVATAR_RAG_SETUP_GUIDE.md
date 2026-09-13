# Avatar knowledge setup

This is the shortest operator/developer path for adding static knowledge. See
[API_CONTRACT.md](API_CONTRACT.md) for exact schemas and endpoints.

## Mental model

Knowledge is registered as a source, ingested into chunks, embedded, and retrieved at runtime. It
is not uploaded as pre-chunked memory — there is no endpoint that accepts raw chunks directly.

Use:

- `avatar_knowledge` for Avatar-specific static facts (backstory, preferences, private notes).
- `world` for scenario lore, setting rules, and canon shared by Avatars.
- `media` for descriptions/references to assets stored outside Core.

The `knowledgeType` controls how retrieval groups and returns results; it does not replace
visibility scoping — those are two independent axes.

There is no separate "attach knowledge to avatar" endpoint. Avatar scoping is entirely handled by
the source's visibility metadata, which chunks inherit at ingestion time. At query time, the
active Avatar in the session determines which chunks are eligible.

## Setup checklist

1. Create the Scenario and Avatar. Save the returned `avatarId` — you need it for
   `visibleToAvatarIds` if the source should be Avatar-private.
2. Prepare clean UTF-8 text/Markdown, a reachable URL, or a media description. Prefer one topic
   per source: splitting a large corpus into several focused sources gives retrieval better recall
   than one large mixed-purpose document, and keeps chunks semantically coherent.
3. Create the source with `knowledgeType`, `format`, `uriOrPath`, and a visibility policy
   (`visibleToAvatarIds`, or omit/empty for shared visibility).
4. Trigger `POST /v1/knowledge-sources/{sourceId}/ingest`. Registering a source only records it —
   ingestion is a separate, explicit step and nothing is retrievable until it completes.
5. Poll the ingestion job (`GET /v1/ingestion-jobs/{id}` or
   `GET /v1/knowledge-sources/{sourceId}/ingestion-jobs`) until `completed`, or investigate
   `failed`. Jobs start `queued`/`running`; pass `correlationId` in the ingest body if you need to
   line the run up with an external workflow.
6. Verify with `POST /v1/admin/knowledge/retrieval` using the intended `scenarioId` and
   `activeAvatarId`. This is the fastest way to confirm the content is searchable and correctly
   scoped before trusting chat quality — the response includes trace metadata showing which chunks
   were selected and how visibility filtering behaved.
7. Start a session and test a question that should require the source.

## Content preparation

- One topic per source; avoid mixing unrelated lore, policy, and media notes in a single file.
- Prefer clean UTF-8 plain text or Markdown; keep headings short and semantic and paragraphs
  factual — this is what ingestion quality and chunk boundaries depend on most.
- Remove navigation boilerplate, duplicate sections, and other chrome before ingestion.
- Keep file names and URLs stable — the source record points at the original location, so moving
  or renaming it breaks future re-ingestion.
- For PDFs, prefer text-based PDFs over scanned images; run OCR first if the PDF is scanned.
- For URLs, make sure the content is reachable at ingestion time.
- Core stores media references/descriptions, not the media asset itself — keep the actual asset
  external and point the source at it.

## Visibility

- `all`: available to all Avatars in the Scenario (omit `visibleToAvatarIds` or send `[]`).
- `avatars`: requires a non-empty allowed-Avatar list; scopes the source (and its inherited chunks)
  to only those Avatars.
- `none`: excluded from Avatar retrieval and available only to explicitly permitted GM/admin views.

Do not use the removed `memory` knowledge type or put `userId`, `sessionId`, or `conversationId` in
source/chunk metadata — those keys are rejected recursively at the API boundary. Static knowledge
is shared scenario material, not user-private conversational memory, and the two lifecycles must
not mix.

Operator screens use the same categories as the API — Shared Avatar Knowledge, Shared World
Knowledge, Media Knowledge — and also show the owning scenario and Avatar visibility policy.

## Suggested patterns

- **Avatar-specific static notes**: `avatar_knowledge`, scoped to one Avatar. Use for private
  backstory, recurring preferences, or facts that should not leak to other Avatars.
- **Shared scenario lore**: `world`, visible to all Avatars. Use for setting rules, historical
  timeline, and scenario canon.
- **Media-supporting content**: `media`, for captions, asset descriptions, or media-linked
  reference notes.

## Common mistakes

- Sending raw chunks directly to the API — it expects a source, not pre-chunked data.
- Using one large mixed-purpose document instead of splitting by theme.
- Forgetting to trigger ingestion after creating the source (a registered source is not yet
  retrievable).
- Assuming a source is Avatar-private without explicitly setting `visibleToAvatarIds`.
- Expecting Core to store the media file itself — keep media external and point at it.

## Example: minimal end-to-end

```bash
# 1. Register the source (scope to one Avatar with visibleToAvatarIds, or omit for shared)
curl -X POST "$BASE_URL/v1/knowledge-sources" -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" -d '{
    "scenarioId": "scenario_id", "name": "Theo notes",
    "knowledgeType": "avatar_knowledge", "format": "markdown",
    "uriOrPath": "/data/theo-notes.md", "visibleToAvatarIds": ["avatar_id"]
  }'

# 2. Trigger ingestion (registering a source does not ingest it)
curl -X POST "$BASE_URL/v1/knowledge-sources/$SOURCE_ID/ingest" -H "x-api-key: $API_KEY"

# 3. Verify retrieval before trusting chat quality
curl -X POST "$BASE_URL/v1/admin/knowledge/retrieval" -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" -d '{
    "scenarioId": "scenario_id", "query": "what does Theo know about the timeline?",
    "activeAvatarId": "avatar_id", "limitPerType": 3
  }'
```

## Related docs

- [API_CONTRACT.md](API_CONTRACT.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [PROJECT_STATUS.md](PROJECT_STATUS.md)
