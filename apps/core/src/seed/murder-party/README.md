# Murder Party RAG Scaffold — The Last Glass at Villa Miralac

This folder contains a first content scaffold for testing:

- scenario creation
- avatar creation
- multi-avatar unlocking
- avatar-scoped RAG visibility
- GM omniscience
- avatar memory and episodic memory
- place/world retrieval
- contradiction handling
- accusation flow

The content is intentionally written as Markdown so it can later be ingested by a bootstrap script.

## Scenario summary

**Title:** The Last Glass at Villa Miralac  
**Genre:** Agatha Christie-style inquiry prototype  
**Setting:** A private lakeside villa near Lausanne, Switzerland  
**Victim:** Lionel Ardent, owner of Villa Miralac  
**Crime:** Lionel is found dead in the winter garden during a stormy private evening.  
**Truth:** Dr. Elias Moreau poisoned Lionel with digitalis concealed in a small vial and added it to Lionel’s cherry liqueur.  
**Initial avatar:** Clara Whitcombe, the housekeeper.

## Main test goals

1. The user starts with only Clara available.
2. Clara mentions the other suspects and progressively opens the interrogation.
3. Each avatar acts according to their own personality, interests, fears, and knowledge.
4. The murderer does not confess simply because asked.
5. The murderer may lie until confronted with enough evidence.
6. Non-murderers may hide unrelated secrets.
7. GM knows the full truth and controls progression.
8. Avatar retrieval must respect `visibleToAvatarIds`.
9. GM retrieval must remain unrestricted.
10. Conversation closure should generate useful episodic memory for later conversations.

## Suggested file mapping

| File                    | Knowledge type  | Visibility                   |
| ----------------------- | --------------- | ---------------------------- |
| `scenario.md`           | world           | all avatars                  |
| `places.md`             | world           | all avatars                  |
| `crime-scene.md`        | world           | all avatars                  |
| `gm-truth.md`           | world           | GM only / not avatar-visible |
| `avatar-clara.md`       | memory          | Clara only                   |
| `avatar-elias.md`       | memory          | Elias only                   |
| `avatar-margot.md`      | memory          | Margot only                  |
| `avatar-thomas.md`      | memory          | Thomas only                  |
| `shared-clues.md`       | world           | all avatars                  |
| `bootstrap-manifest.md` | bootstrap notes | operator only                |
| `test-script.md`        | QA              | operator only                |

## Important design decision

This is not a scripted chatbot scenario.  
The content defines people, memories, places, facts, and evidence.

The avatars should not merely recite their files. They should use their personality and memory to answer naturally.

## API bootstrap script

This folder now includes an API-first bootstrap script:

- `setup-via-api.ts`

The script provisions the full murder-party demo environment through HTTP endpoints:

1. create or update scenario
2. create or update avatars
3. register knowledge sources for world and avatar memory
4. trigger ingestion and wait for completion
5. patch scenario `avatarAvailability` with unlocked and unlockable avatars

### Why it works for local and production

The script does not depend on server-side local file access.

Instead, it reads local Markdown files and sends their content as `metadata.inlineText` when creating knowledge sources. This makes setup portable across environments.

### Configuration

Required:

- `MURDER_PARTY_API_BASE_URL` or `--base-url`
- `MURDER_PARTY_API_KEY` or `--api-key`

Optional:

- `--scenario-name` (default: `The Last Glass at Villa Miralac`)
- `--poll-interval-ms` (default: `300`)
- `--poll-timeout-ms` (default: `180000`)
- `--reingest-existing` (`true|false`, default: `true`)

### Run from repository root

```bash
# Local default target (http://localhost:3000)
MURDER_PARTY_API_KEY=your-local-key pnpm seed:murder-party:api:local

# Explicit target (local or production)
MURDER_PARTY_API_BASE_URL=https://your-core.example.com \
MURDER_PARTY_API_KEY=your-api-key \
pnpm seed:murder-party:api

# Production convenience alias (requires env vars)
MURDER_PARTY_API_BASE_URL=https://your-core.example.com \
MURDER_PARTY_API_KEY=your-api-key \
pnpm seed:murder-party:api:prod
```

### Direct run from core package

```bash
pnpm --filter @gami/core seed:murder-party:api -- \
	--base-url https://your-core.example.com \
	--api-key your-api-key \
	--scenario-name "The Last Glass at Villa Miralac"
```

### Script output

The script prints a JSON summary with:

- created/updated `scenarioId`
- avatar IDs keyed by slug
- source count
- warnings

Warnings are expected if seed-tagged knowledge sources already exist with different content and cannot be replaced through current API endpoints.
