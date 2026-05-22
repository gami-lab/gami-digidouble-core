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

| File               | knowledgeType | visibleToAvatarIds |
| ------------------ | ------------- | ------------------ |
| `scenario.md`      | world         | []                 |
| `places.md`        | world         | []                 |
| `crime-scene.md`   | world         | []                 |
| `shared-clues.md`  | world         | []                 |
| `avatar-clara.md`  | memory        | ["clara"]          |
| `avatar-elias.md`  | memory        | ["elias"]          |
| `avatar-margot.md` | memory        | ["margot"]         |
| `avatar-thomas.md` | memory        | ["thomas"]         |
| `gm-truth.md`      | world         | ["__GM_ONLY__"]    |

## GM-only knowledge

Current system may not support a special `__GM_ONLY__` avatar ID directly.

Implementation options:

### Option A — Do not register `gm-truth.md` as normal avatar-visible knowledge

Keep it as operator/bootstrap data and inject it only into GM configuration.

### Option B — Register it with a fake visibility ID

Use `visibleToAvatarIds: ["__GM_ONLY__"]`.

No real avatar has this ID, so avatar retrieval should exclude it. GM unrestricted retrieval should still see it.

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
