# Avatar RAG Setup Guide

This guide explains how to prepare data for an avatar, register it as a knowledge source, ingest it into the RAG pipeline, and verify that the avatar can retrieve it.

It is based on the public API contract in [API_CONTRACT.md](API_CONTRACT.md) and the current knowledge subsystem behavior.

## Mental Model

RAG setup in this project is source-based, not upload-based.

You do not send raw chunk data directly to the API. Instead, you:

1. create an avatar in a scenario
2. prepare a knowledge source file, URL, or media description
3. register that source with the API
4. trigger ingestion
5. let the retrieval layer use the resulting chunks at runtime

If you want the knowledge to be available only to one avatar, scope the source with `visibleToAvatarIds`.

## What To Prepare

The API accepts a knowledge source record with these key fields:

- `scenarioId`
- `name`
- `knowledgeType` (`memory`, `world`, or `media`)
- `format` (`pdf`, `text`, `markdown`, `url`, or `media`)
- `uriOrPath`
- optional `metadata`
- optional `visibleToAvatarIds`

### Recommended preparation rules

- Use one topic per source when possible.
- Prefer clean UTF-8 plain text or Markdown for best ingestion quality.
- Keep file names and URLs stable, because the source points at the original location.
- Remove duplicate sections, navigation chrome, and obvious boilerplate before ingestion.
- For PDFs, prefer text-based PDFs over scanned images. If the PDF is scanned, run OCR first.
- For URLs, make sure the content is reachable when ingestion runs.
- For media, store the actual asset outside the Core and provide the descriptive metadata or reference the loader expects.

### Choosing `knowledgeType`

Use the type that matches the role of the content:

- `memory`: avatar-specific facts, preferences, backstory details, recurring facts, or private knowledge for one avatar
- `world`: scenario lore, setting rules, canon facts, and shared world-building
- `media`: media-related descriptions, references, or metadata for assets that should inform responses

The type controls how the retrieval system groups and returns the content. It does not replace visibility scoping.

## Avatar Setup Flow

### 1. Create the scenario and avatar

An avatar belongs to a scenario. Create the scenario first if it does not already exist, then create the avatar under it.

```bash
curl -X POST "$BASE_URL/v1/scenarios/$SCENARIO_ID/avatars" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "Theo",
    "personaPrompt": "You are Theo, an expert guide who answers directly and stays concise.",
    "tone": "helpful and precise",
    "status": "active"
  }'
```

Save the returned `avatarId`. If you want the knowledge to be avatar-specific, you will use that ID in `visibleToAvatarIds`.

### 2. Prepare the source data

Decide what the source is:

- a local file path, for example `/data/avatars/theo-notes.md`
- a URL, for example `https://example.com/theo-lore`
- a media reference, for example a structured description or asset locator

Then normalize the content so it is easy to retrieve:

- keep headings short and semantic
- prefer short paragraphs and factual statements
- separate distinct subjects into separate files or sources
- avoid mixing unrelated lore, policy, and media notes in one file

If you already have a lot of material, split it into multiple sources rather than forcing one huge document. That gives retrieval better recall and keeps chunks more focused.

### 3. Register the knowledge source

Use `POST /v1/knowledge-sources` to tell the Core where the data lives.

If the source should only be visible to one avatar, include `visibleToAvatarIds`.
If it should be shared across avatars, omit the field or send an empty array.

```bash
curl -X POST "$BASE_URL/v1/knowledge-sources" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "scenarioId": "scenario_01jwxxxxxx",
    "name": "Theo private notes",
    "knowledgeType": "memory",
    "format": "markdown",
    "uriOrPath": "/data/avatars/theo-notes.md",
    "metadata": {
      "sourceCategory": "avatar_notes"
    },
    "visibleToAvatarIds": ["avatar_01jwxxxxxx"]
  }'
```

Validation rules to keep in mind:

- unknown fields are rejected
- `scenarioId`, `name`, `knowledgeType`, `format`, and `uriOrPath` are required
- `visibleToAvatarIds` items must be non-empty strings

### 4. Trigger ingestion

Creating the source only registers it. Ingestion is a separate step.

```bash
curl -X POST "$BASE_URL/v1/knowledge-sources/$SOURCE_ID/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{}'
```

The response returns an ingestion job. The job starts as `queued` or `running` and eventually becomes `completed` or `failed`.

If you need to correlate the run with an external workflow, you can include `correlationId` in the request body.

### 5. Poll ingestion status

Use the ingestion job endpoints to watch progress.

```bash
curl -X GET "$BASE_URL/v1/ingestion-jobs/$INGESTION_JOB_ID" \
  -H "x-api-key: $API_KEY"
```

You can also list all jobs for a source:

```bash
curl -X GET "$BASE_URL/v1/knowledge-sources/$SOURCE_ID/ingestion-jobs" \
  -H "x-api-key: $API_KEY"
```

When the job is `completed`, the source has been chunked and indexed for retrieval.

### 6. Verify retrieval before using it in chat

The admin retrieval endpoint is the fastest way to confirm the knowledge is searchable and scoped correctly.

```bash
curl -X POST "$BASE_URL/v1/admin/knowledge/retrieval" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "scenarioId": "scenario_01jwxxxxxx",
    "query": "what does Theo know about the timeline?",
    "activeAvatarId": "avatar_01jwxxxxxx",
    "limitPerType": 3
  }'
```

The response is typed by layer:

- `memory`
- `world`
- `media`

It also includes trace metadata so you can see which chunks were selected and how visibility filtering behaved.

## How Avatar Scoping Works

There is no separate endpoint that “attaches” knowledge directly to an avatar.

Instead, avatar scoping is handled by visibility metadata:

- set `visibleToAvatarIds: ["avatar_id"]` when creating the source to scope it to one avatar
- omit `visibleToAvatarIds` or send an empty array to make the source visible to all avatars
- the source-level visibility is inherited by the created chunks

At runtime, the active avatar in the session determines which chunks are considered during retrieval.

## Suggested Setup Patterns

### Avatar-private notes

Use `knowledgeType: "memory"` and scope the source to one avatar.

Example use cases:

- private backstory
- recurring preferences
- avatar-specific facts that should not be shared with others

### Shared scenario lore

Use `knowledgeType: "world"` and leave the source visible to all avatars.

Example use cases:

- setting rules
- historical timeline
- scenario canon

### Media-supporting content

Use `knowledgeType: "media"` for descriptions or metadata tied to external assets.

Example use cases:

- image captions
- asset descriptions
- media-linked reference notes

## Common Mistakes

- Sending raw chunks directly to the API. The API expects a source, not pre-chunked data.
- Using one large mixed-purpose document. Split by theme instead.
- Forgetting to trigger ingestion after creating the source.
- Assuming a source is avatar-private without setting `visibleToAvatarIds`.
- Expecting the Core to store the media file itself. Keep media external and point at it.

## Minimal End-to-End Checklist

1. Create the scenario.
2. Create the avatar.
3. Prepare the file, URL, or media description.
4. Register the knowledge source with the correct `knowledgeType` and `format`.
5. Add `visibleToAvatarIds` if the data should only be available to that avatar.
6. Trigger ingestion.
7. Wait for the job to complete.
8. Verify retrieval with `POST /v1/admin/knowledge/retrieval`.
9. Start a session with the avatar and send a message normally.

## Related Docs

- [API_CONTRACT.md](API_CONTRACT.md)
- [API_GUIDE.md](../API_GUIDE.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [PROJECT_STATUS.md](PROJECT_STATUS.md)
