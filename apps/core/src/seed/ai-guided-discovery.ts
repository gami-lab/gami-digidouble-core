import { pathToFileURL } from 'node:url'
import { loadConfig } from '../config.js'
import type { CreateAvatarParams } from '../application/ports/IAvatarRepository.js'
import type { CreateScenarioParams } from '../application/ports/IScenarioRepository.js'
import type { AvatarConfig } from '../domain/avatar/avatar.types.js'
import type { Scenario } from '../domain/scenario/scenario.types.js'
import {
  getDbClient,
  closeDbClient,
  PostgresAvatarRepository,
  PostgresScenarioRepository,
} from '../infrastructure/db/index.js'

const SCENARIO_NAME = 'AI Guided Discovery'
const FIXTURE_TIMESTAMP = '2026-04-27T00:00:00.000Z'

type AiGuidedDiscoveryAvatarDefinition = {
  routeKey: string
  fixtureAvatarId: string
  name: string
  status: AvatarConfig['status']
  description: string
  tone: string
  personaPrompt: string
  config: Record<string, unknown>
}

export const aiGuidedDiscoveryScenarioConfig: CreateScenarioParams = {
  name: SCENARIO_NAME,
  status: 'active',
  config: {
    worldContext:
      'A guided learning experience about AI where a generalist guide introduces specialists only when the topic genuinely needs them.',
    objectives: [
      'Introduce AI concepts progressively.',
      'Demonstrate bounded competence between avatars.',
      'Expose unlockable specialist routing inside one session.',
    ],
    topicSignals: [
      {
        topicId: 'technical',
        keywords: [
          'transformer',
          'transformers',
          'llm',
          'embeddings',
          'rag',
          'training',
          'inference',
          'latency',
          'scaling',
          'provider',
          'providers',
          'model architecture',
        ],
      },
      {
        topicId: 'ethics',
        keywords: [
          'bias',
          'fairness',
          'privacy',
          'regulation',
          'transparency',
          'trust',
          'oversight',
          'dangerous',
          'society',
          'societal impact',
        ],
      },
    ],
    avatarAvailability: {
      initialAvatarKeys: ['guide'],
      unlockRules: [
        {
          sourceAvatarKey: 'guide',
          targetAvatarKey: 'theo',
          topicId: 'technical',
          introductionMessage:
            'If you want to go deeper on how models work internally, I can introduce Theo.',
        },
        {
          sourceAvatarKey: 'guide',
          targetAvatarKey: 'eva',
          topicId: 'ethics',
          introductionMessage:
            'If you want to focus on risks, bias, and responsible AI, I can introduce Eva.',
        },
      ],
    },
  },
}

const aiGuidedDiscoveryAvatarDefinitions: AiGuidedDiscoveryAvatarDefinition[] = [
  {
    routeKey: 'guide',
    fixtureAvatarId: 'avatar_mira',
    name: 'Mira',
    status: 'active',
    description: 'Friendly first-contact guide for broad AI discovery.',
    tone: 'Warm, clear, and approachable.',
    personaPrompt:
      'You are Mira, a friendly and knowledgeable AI guide. Explain concepts simply, stay broad, and introduce specialists only when the user needs deeper technical or ethical expertise.',
    config: {
      routeKey: 'guide',
      ui: { unlockState: 'available' },
    },
  },
  {
    routeKey: 'theo',
    fixtureAvatarId: 'avatar_theo',
    name: 'Theo',
    status: 'active',
    description: 'Technical AI specialist focused on models and systems.',
    tone: 'Precise, technical, and grounded.',
    personaPrompt:
      'You are Theo, an expert in technical AI topics such as LLMs, transformers, embeddings, training, inference, RAG, agents, latency, cost, scaling, and model providers. Stay technical and do not drift into ethics coaching.',
    config: {
      routeKey: 'theo',
      ui: { unlockState: 'locked' },
      competenceBoundary: {
        allowedTopicIds: ['technical'],
        redirects: [
          {
            topicId: 'ethics',
            message:
              "That question belongs more to Eva or the guide. I can help with implementation details, but ethics and societal risk are Eva's domain.",
          },
        ],
      },
    },
  },
  {
    routeKey: 'eva',
    fixtureAvatarId: 'avatar_eva',
    name: 'Eva',
    status: 'active',
    description: 'Ethics and responsible AI specialist.',
    tone: 'Thoughtful, balanced, and practical.',
    personaPrompt:
      'You are Eva, an expert in AI ethics and responsible AI. Focus on bias, fairness, transparency, privacy, regulation, oversight, and societal impact. Redirect deep implementation questions back to Theo or the guide.',
    config: {
      routeKey: 'eva',
      ui: { unlockState: 'locked' },
      competenceBoundary: {
        allowedTopicIds: ['ethics'],
        redirects: [
          {
            topicId: 'technical',
            message:
              'Theo or the guide is a better fit for deep infrastructure details. I can stay with the ethics, governance, and human oversight side.',
          },
        ],
      },
    },
  },
]

function toCreateAvatarParams(
  definition: AiGuidedDiscoveryAvatarDefinition,
  scenarioId: string,
): CreateAvatarParams {
  return {
    scenarioId,
    name: definition.name,
    status: definition.status,
    description: definition.description,
    tone: definition.tone,
    personaPrompt: definition.personaPrompt,
    config: definition.config,
  }
}

function toFixtureAvatar(
  definition: AiGuidedDiscoveryAvatarDefinition,
  scenarioId: string,
): AvatarConfig {
  return {
    avatarId: definition.fixtureAvatarId,
    scenarioId,
    name: definition.name,
    status: definition.status,
    description: definition.description,
    tone: definition.tone,
    personaPrompt: definition.personaPrompt,
    config: definition.config,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  }
}

export function buildAiGuidedDiscoveryAvatarSeedParams(scenarioId: string): CreateAvatarParams[] {
  return aiGuidedDiscoveryAvatarDefinitions.map((definition) =>
    toCreateAvatarParams(definition, scenarioId),
  )
}

export function buildAiGuidedDiscoveryFixture(): {
  scenario: Scenario
  avatars: AvatarConfig[]
} {
  const scenario: Scenario = {
    scenarioId: 'scenario_ai_guided_discovery',
    name: SCENARIO_NAME,
    status: 'active',
    config: aiGuidedDiscoveryScenarioConfig.config as Scenario['config'],
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  }

  const avatars = aiGuidedDiscoveryAvatarDefinitions.map((definition) =>
    toFixtureAvatar(definition, scenario.scenarioId),
  )

  return { scenario, avatars }
}

export async function ensureAiGuidedDiscoverySeed(): Promise<{
  scenarioId: string
  avatarIds: string[]
}> {
  const config = loadConfig()
  const sql = getDbClient(config.databaseUrl)
  const scenarioRepository = new PostgresScenarioRepository(sql)
  const avatarRepository = new PostgresAvatarRepository(sql)

  try {
    const existingScenario = (await scenarioRepository.list()).find(
      (scenario) => scenario.name === SCENARIO_NAME,
    )
    const scenario =
      existingScenario ?? (await scenarioRepository.create(aiGuidedDiscoveryScenarioConfig))

    const existingAvatars = await avatarRepository.listByScenarioId(scenario.scenarioId)
    const existingRouteKeys = new Set(
      existingAvatars
        .map((avatar) => avatar.config['routeKey'])
        .filter((routeKey): routeKey is string => typeof routeKey === 'string'),
    )

    for (const avatarSeed of buildAiGuidedDiscoveryAvatarSeedParams(scenario.scenarioId)) {
      const routeKey = avatarSeed.config?.['routeKey']
      if (typeof routeKey !== 'string' || existingRouteKeys.has(routeKey)) {
        continue
      }

      await avatarRepository.create({
        ...avatarSeed,
        scenarioId: scenario.scenarioId,
      })
    }

    const avatars = await avatarRepository.listByScenarioId(scenario.scenarioId)
    return {
      scenarioId: scenario.scenarioId,
      avatarIds: avatars.map((avatar) => avatar.avatarId),
    }
  } finally {
    await closeDbClient()
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await ensureAiGuidedDiscoverySeed()
  console.log(JSON.stringify(result, null, 2))
}
