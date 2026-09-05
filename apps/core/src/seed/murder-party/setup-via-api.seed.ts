export type AvatarSlug = 'clara' | 'elias' | 'margot' | 'thomas'

export type KnowledgeType = 'memory' | 'world' | 'media'
export type KnowledgeFormat = 'pdf' | 'text' | 'markdown' | 'url' | 'media'

export type AvatarSeed = {
  slug: AvatarSlug
  name: string
  tone: string
  description: string
  personaPrompt: string
  initiallyUnlocked: boolean
}

export type SourceVisibility =
  'public' | 'gm-only' | 'avatar-clara' | 'avatar-elias' | 'avatar-margot' | 'avatar-thomas'

export type SourceSeed = {
  slug: string
  fileName: string
  name: string
  knowledgeType: KnowledgeType
  format: KnowledgeFormat
  visibility: SourceVisibility
}

export const SCENARIO_SEED_SLUG = 'murder-party-villa-miralac'

export const AVATAR_SEEDS: AvatarSeed[] = [
  {
    slug: 'clara',
    name: 'Clara Whitcombe',
    tone: 'careful, polite, observant, restrained',
    description: 'Housekeeper, witness, and initial avatar.',
    personaPrompt:
      'You are Clara Whitcombe, the housekeeper of Villa Miralac. You are observant, precise, and discreet. You are not the murderer. Help the investigator with concrete facts and careful reasoning. Mention other suspects when useful and avoid dramatic accusations without evidence.',
    initiallyUnlocked: true,
  },
  {
    slug: 'elias',
    name: 'Dr. Elias Moreau',
    tone: 'precise, composed, aristocratic, defensive',
    description: 'Physician and primary suspect.',
    personaPrompt:
      'You are Dr. Elias Moreau, physician and old friend of Lionel Ardent. You are controlled and analytical. Do not confess unless confronted with a strong chain of evidence. Keep responses grounded, avoid theatrical behavior, and protect your interests under pressure.',
    initiallyUnlocked: false,
  },
  {
    slug: 'margot',
    name: 'Margot Vale',
    tone: 'witty, anxious, emotional, defensive',
    description: 'Niece of the victim, false lead with hidden secret.',
    personaPrompt:
      "You are Margot Vale, Lionel Ardent's niece. You are sharp, emotionally reactive, and under financial pressure. You are not the murderer. You may hide compromising details at first, then reveal them when pressed with specific evidence.",
    initiallyUnlocked: false,
  },
  {
    slug: 'thomas',
    name: 'Thomas Reed',
    tone: 'nervous, intense, idealistic, slightly arrogant',
    description: 'Journalist and key timeline witness.',
    personaPrompt:
      'You are Thomas Reed, a journalist and former protege of Lionel Ardent. You are not the murderer. You initially protect your source and your reputation, but become more transparent under focused timeline questioning.',
    initiallyUnlocked: false,
  },
]

export const SOURCE_SEEDS: SourceSeed[] = [
  {
    slug: 'scenario-world',
    fileName: 'scenario.md',
    name: 'Murder Party Scenario',
    knowledgeType: 'world',
    format: 'markdown',
    visibility: 'public',
  },
  {
    slug: 'places-world',
    fileName: 'places.md',
    name: 'Villa Miralac Places',
    knowledgeType: 'world',
    format: 'markdown',
    visibility: 'public',
  },
  {
    slug: 'crime-scene-world',
    fileName: 'crime-scene.md',
    name: 'Crime Scene Facts',
    knowledgeType: 'world',
    format: 'markdown',
    visibility: 'public',
  },
  {
    slug: 'shared-clues-world',
    fileName: 'shared-clues.md',
    name: 'Shared Clues',
    knowledgeType: 'world',
    format: 'markdown',
    visibility: 'public',
  },
  {
    slug: 'clara-memory',
    fileName: 'avatar-clara.md',
    name: 'Clara Private Memory',
    knowledgeType: 'memory',
    format: 'markdown',
    visibility: 'avatar-clara',
  },
  {
    slug: 'elias-memory',
    fileName: 'avatar-elias.md',
    name: 'Elias Private Memory',
    knowledgeType: 'memory',
    format: 'markdown',
    visibility: 'avatar-elias',
  },
  {
    slug: 'margot-memory',
    fileName: 'avatar-margot.md',
    name: 'Margot Private Memory',
    knowledgeType: 'memory',
    format: 'markdown',
    visibility: 'avatar-margot',
  },
  {
    slug: 'thomas-memory',
    fileName: 'avatar-thomas.md',
    name: 'Thomas Private Memory',
    knowledgeType: 'memory',
    format: 'markdown',
    visibility: 'avatar-thomas',
  },
  {
    slug: 'gm-truth',
    fileName: 'gm-truth.md',
    name: 'GM Truth Sheet',
    knowledgeType: 'world',
    format: 'markdown',
    visibility: 'gm-only',
  },
]

export const SCENARIO_WORLD_CONTEXT =
  'A storm traps four people inside Villa Miralac, an old house overlooking Lake Geneva. Lionel Ardent, the owner, is found dead in the winter garden shortly before midnight. The user plays an invited investigator who must question the suspects, reconstruct the timeline, compare memories, find contradictions, and identify the murderer among Clara, Elias, Margot, and Thomas.'

export const SCENARIO_OBJECTIVES: string[] = [
  'Guide the investigator through a multi-avatar murder inquiry at Villa Miralac.',
  'Reveal that Lionel Ardent was poisoned with digitalis, not killed by natural causes.',
  "Help the user uncover Elias's motive, access to poison, and timeline contradictions.",
  'Let the user reach a supported accusation of Dr. Elias Moreau with at least three evidence points.',
]

export function getScenarioBaseConfig(): Record<string, unknown> {
  return {
    seedSlug: SCENARIO_SEED_SLUG,
    genre: 'agatha-christie-prototype',
    initialAvatarKey: 'clara',
    progressionMilestones: [
      'intro',
      'suspects_unlocked',
      'crime_scene_established',
      'timeline_started',
      'motive_layer_open',
      'poison_clue_found',
      'contradiction_found',
      'final_accusation_ready',
      'solved',
    ],
    solution: {
      murdererAvatarKey: 'elias',
      requiredEvidenceCount: 3,
    },
  }
}
