# Avatar knowledge setup

This is the shortest operator/developer path for adding static knowledge. See
[API_CONTRACT.md](API_CONTRACT.md) for exact schemas.

## Mental model

Knowledge is registered as a source, ingested into chunks, embedded, and retrieved at runtime. It
is not uploaded as pre-chunked memory.

Use:

- `avatar_knowledge` for Avatar-specific static facts.
- `world` for scenario lore and canon shared by Avatars.
- `media` for descriptions/references to assets stored outside Core.

Use an explicit source visibility policy. Avatar visibility is source-owned and inherited by chunks;
static knowledge is never user/session/conversation memory.

## Setup checklist

1. Create the Scenario and Avatar.
2. Prepare clean UTF-8 text/Markdown, a reachable URL, or a media description. Prefer one topic per source.
3. Create the source with `knowledgeType`, `format`, `uriOrPath`, and visibility policy.
4. Trigger `POST /v1/knowledge-sources/{sourceId}/ingest`.
5. Poll the ingestion job until `completed` or investigate `failed`.
6. Verify with `POST /v1/admin/knowledge/retrieval` using the intended `scenarioId` and `activeAvatarId`.
7. Start a session and test a question that should require the source.

## Visibility

- `all`: available to all Avatars in the Scenario.
- `avatars`: requires a non-empty allowed-Avatar list.
- `none`: excluded from Avatar retrieval and available only to explicitly permitted GM/admin views.

Do not use the removed `memory` knowledge type or put `userId`, `sessionId`, or `conversationId` in
source/chunk metadata.

## Content guidance

Prefer focused sources, meaningful headings, factual paragraphs, and stable source locations. Remove
navigation boilerplate and duplicate text. Core stores media references/descriptions, not media
assets. Retrieval diagnostics should confirm visibility and source type before chat quality is judged.
