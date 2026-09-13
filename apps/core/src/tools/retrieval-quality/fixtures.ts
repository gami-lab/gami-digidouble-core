import type { KnowledgeType } from '../../domain/knowledge/knowledge.types.js'

export type RetrievalQualityFixture = Readonly<{
  fixtureId: string
  scenarioId: string
  knowledgeType: KnowledgeType
  query: string
  expectedChunkIds: readonly string[]
  rationale: string
}>

export type RetrievalQualityChunk = Readonly<{
  chunkId: string
  sourceId: string
  scenarioId: string
  knowledgeType: KnowledgeType
  content: string
  chunkIndex: number
}>

export const RETRIEVAL_QUALITY_VERSION = 1
export const RETRIEVAL_QUALITY_SCENARIO_ID = 'murder-party-villa-miralac'
export const RETRIEVAL_QUALITY_K_VALUES = [3, 7, 9] as const

/**
 * Queries are deliberately phrased as investigator questions rather than copied headings.
 * Expected IDs point to the smallest source excerpts that answer each question.
 */
export const RETRIEVAL_QUALITY_FIXTURES: readonly RetrievalQualityFixture[] = [
  {
    fixtureId: 'crime-scene-digitalis',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'world',
    query: 'What poison killed Lionel Ardent?',
    expectedChunkIds: ['crime-scene-digitalis'],
    rationale: 'Sourced from crime-scene.md: the medical clue names digitalis poisoning.',
  },
  {
    fixtureId: 'clara-medical-case',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    query: 'Where did Clara see Elias carrying his medical case?',
    expectedChunkIds: ['clara-medical-case'],
    rationale: 'Sourced from avatar-clara.md: the 22:08 observation names the servants corridor.',
  },
  {
    fixtureId: 'elias-motive',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    query: 'Why did Elias need to stop Lionel from exposing him?',
    expectedChunkIds: ['elias-motive'],
    rationale:
      'Sourced from avatar-elias.md: Lionel held the clinical-trial documents and threatened exposure.',
  },
  {
    fixtureId: 'thomas-timeline',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    query: 'What did Thomas see Elias doing around 22:20?',
    expectedChunkIds: ['thomas-timeline'],
    rationale:
      'Sourced from avatar-thomas.md: Thomas saw Elias near the terrace and winter garden.',
  },
  {
    fixtureId: 'margot-envelope',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    query: 'What did Margot steal from Lionel after the death?',
    expectedChunkIds: ['margot-envelope'],
    rationale: 'Sourced from avatar-margot.md: Margot took an envelope from the open study drawer.',
  },
  {
    fixtureId: 'winter-garden-location',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'world',
    query: 'Where was Lionel found dead?',
    expectedChunkIds: ['winter-garden-location'],
    rationale: 'Sourced from crime-scene.md: discovery occurred in the winter garden.',
  },
]

/** Verbatim excerpts from the murder-party seed, plus nearby distractors for rank debugging. */
export const RETRIEVAL_QUALITY_CHUNKS: readonly RetrievalQualityChunk[] = [
  {
    chunkId: 'crime-scene-digitalis',
    sourceId: 'crime-scene-world',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'world',
    chunkIndex: 0,
    content:
      "Lionel's pulse and symptoms were consistent with digitalis poisoning. Dr. Elias Moreau was too quick to call it a heart attack.",
  },
  {
    chunkId: 'winter-garden-location',
    sourceId: 'crime-scene-world',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'world',
    chunkIndex: 1,
    content: 'Lionel Ardent was found dead in the winter garden at approximately 22:40.',
  },
  {
    chunkId: 'world-damp-footprints',
    sourceId: 'places-world',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'world',
    chunkIndex: 0,
    content:
      'The winter garden has damp footprints entering from the terrace door and a strong smell of wet leaves and alcohol.',
  },
  {
    chunkId: 'world-boathouse',
    sourceId: 'places-world',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'world',
    chunkIndex: 1,
    content:
      'The boathouse contains an old rowing boat, an oil lamp, damp rope, a locked cabinet, and a broken oar.',
  },
  {
    chunkId: 'clara-medical-case',
    sourceId: 'avatar-clara-knowledge',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    chunkIndex: 0,
    content:
      'At 22:08 in the servants corridor, Clara saw Elias come out of the study carrying a small silver medical case.',
  },
  {
    chunkId: 'clara-cherry-liqueur',
    sourceId: 'avatar-clara-knowledge',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    chunkIndex: 1,
    content: 'Clara knows Lionel often drank cherry liqueur in the winter garden.',
  },
  {
    chunkId: 'elias-motive',
    sourceId: 'avatar-elias-knowledge',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    chunkIndex: 0,
    content:
      'Lionel threatened to expose Elias because Elias had falsified parts of a clinical-trial report. Lionel kept the original documents.',
  },
  {
    chunkId: 'elias-digitalis',
    sourceId: 'avatar-elias-knowledge',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    chunkIndex: 1,
    content:
      'Elias carried concentrated digitalis in a small vial inside his medical case and knew Lionel had a heart condition.',
  },
  {
    chunkId: 'thomas-timeline',
    sourceId: 'avatar-thomas-knowledge',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    chunkIndex: 0,
    content:
      'At 22:20, Thomas saw Elias near the terrace door, moving toward or away from the winter garden. Elias was not in the library.',
  },
  {
    chunkId: 'thomas-papers',
    sourceId: 'avatar-thomas-knowledge',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    chunkIndex: 1,
    content:
      'Thomas heard Lionel say: Tomorrow morning, Elias. The papers go out tomorrow morning.',
  },
  {
    chunkId: 'margot-envelope',
    sourceId: 'avatar-margot-knowledge',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    chunkIndex: 0,
    content:
      "After hearing commotion, Margot entered Lionel's study and took an envelope from the open drawer. The theft was unrelated to the murder.",
  },
  {
    chunkId: 'margot-boathouse',
    sourceId: 'avatar-margot-knowledge',
    scenarioId: RETRIEVAL_QUALITY_SCENARIO_ID,
    knowledgeType: 'avatar_knowledge',
    chunkIndex: 1,
    content: 'Margot briefly went near the boathouse to hide a personal letter.',
  },
]
