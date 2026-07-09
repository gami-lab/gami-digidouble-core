---
scenarioId: murder-party-villa-miralac
name: Bootstrap Manifest
type: bootstrap-notes
---

# Bootstrap Manifest

This file describes how the Markdown scaffold can later be mapped to the Core.

## Scenario

Create one scenario:

```json
{
  "scenarioId": "murder-party-villa-miralac",
  "name": "The Last Glass at Villa Miralac",
  "status": "active",
  "config": {
    "genre": "agatha-christie-prototype",
    "initialAvatarKey": "clara",
    "progressionMilestones": [
      "intro",
      "suspects_unlocked",
      "crime_scene_established",
      "timeline_started",
      "motive_layer_open",
      "poison_clue_found",
      "contradiction_found",
      "final_accusation_ready",
      "solved"
    ],
    "solution": {
      "murdererAvatarKey": "elias",
      "requiredEvidenceCount": 3
    }
  }
}
```

## Avatars

Create four avatars:

| avatarKey | name             | initial status              |
| --------- | ---------------- | --------------------------- |
| clara     | Clara Whitcombe  | active / initially unlocked |
| elias     | Dr. Elias Moreau | active / locked             |
| margot    | Margot Vale      | active / locked             |
| thomas    | Thomas Reed      | active / locked             |

Suggested `config` shape:

```json
{
  "avatarKey": "clara",
  "initiallyUnlocked": true,
  "role": "housekeeper",
  "isMurderer": false
}
```

## Unlock rules

For a first scaffold, keep unlock logic simple and GM-driven.

Suggested behavior:

1. Start with Clara only.
2. After Clara names the suspects, unlock Margot, Thomas, and Elias.
3. If the user asks for a specific named suspect, GM may unlock that suspect.
4. If the user asks to inspect the scene, GM keeps Clara active but can surface place knowledge.
5. If enough evidence exists, GM marks `final_accusation_ready`.

## Knowledge sources

Register these Markdown files as knowledge sources:

| File               | knowledgeType | visibilityPolicy | visibleToAvatarIds |
| ------------------ | ------------- | ---------------- | ------------------ |
| `scenario.md`      | world         | all              | —                  |
| `places.md`        | world         | all              | —                  |
| `crime-scene.md`   | world         | all              | —                  |
| `shared-clues.md`  | world         | all              | —                  |
| `avatar-clara.md`  | memory        | avatars          | ["clara"]          |
| `avatar-elias.md`  | memory        | avatars          | ["elias"]          |
| `avatar-margot.md` | memory        | avatars          | ["margot"]         |
| `avatar-thomas.md` | memory        | avatars          | ["thomas"]         |
| `gm-truth.md`      | world         | none             | —                  |

## GM-only knowledge

Sources with `visibilityPolicy: "none"` are excluded from every avatar's retrieval scope while
remaining visible to the Game Master's unrestricted retrieval channel (see
`docs/GAME_MASTER_CONTRACT.md`). This is the canonical way to represent GM-only world knowledge —
no fake avatar ID or sentinel value is needed.

This is useful for testing GM omniscience and visibility diagnostics.

## Expected runtime checks

1. Query as Clara: Clara should retrieve public world files and `avatar-clara.md`, not Elias's memory.
2. Query as Elias: Elias should retrieve public world files and `avatar-elias.md`, not Clara's memory.
3. Query as Margot: Margot should retrieve her memory but not Thomas's.
4. Query as Thomas: Thomas should retrieve his memory and public clues.
5. GM inspection should show unrestricted retrieval counts.
6. Runtime inspector should show excluded counts for non-visible chunks.

## Non-goals

Do not add place entities yet.

Do not add clue entities yet.

Do not add complex ACLs.

Use scenario config, avatar config, knowledge metadata, memory, and GM progression.
