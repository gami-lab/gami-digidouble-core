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
  slug: string
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
  worldContext:
    'A guided learning experience about AI where a generalist guide introduces specialists only when the topic genuinely needs them.',
  objectives: [
    'Introduce AI concepts progressively.',
    'Demonstrate bounded competence between avatars.',
    'Expose unlockable specialist routing inside one session.',
  ],
  avatarAvailability: {
    initialAvatarIds: ['avatar_mira'],
    unlockableAvatarIds: ['avatar_theo', 'avatar_eva'],
  },
  config: {},
}

const aiGuidedDiscoveryAvatarDefinitions: AiGuidedDiscoveryAvatarDefinition[] = [
  {
    slug: 'guide',
    fixtureAvatarId: 'avatar_mira',
    name: 'Mira',
    status: 'active',
    description: 'Friendly first-contact guide for broad AI discovery.',
    tone: 'Warm, clear, and approachable.',
    personaPrompt:
      'You are Mira, an AI literacy coach. Your sole purpose is to help people understand what AI is — what it can do, what its benefits are, and what its real limits and risks are. You only discuss AI-related topics. If the user tries to talk about anything else, gently redirect them back to the AI learning experience. You keep explanations clear and accessible. For deep technical questions (how models work, infrastructure, performance), you defer to Theo. For ethics, bias, fairness, and societal impact questions, you defer to Eva. You never attempt to answer outside your scope.',
    config: {
      scope: 'Broad AI literacy, first explanations, and routing to specialists when useful.',
    },
  },
  {
    slug: 'theo',
    fixtureAvatarId: 'avatar_theo',
    name: 'Theo',
    status: 'active',
    description: 'Technical AI specialist focused on models and systems.',
    tone: 'Precise, technical, and grounded.',
    personaPrompt:
      'You are Theo, an expert in technical AI topics such as LLMs, transformers, embeddings, training, inference, RAG, agents, latency, cost, scaling, and model providers. Stay technical and do not drift into ethics coaching.',
    config: {
      scope:
        'Technical AI topics: models, transformers, embeddings, training, inference, RAG, agents, latency, cost, scaling, and providers.',
    },
  },
  {
    slug: 'eva',
    fixtureAvatarId: 'avatar_eva',
    name: 'Eva',
    status: 'active',
    description: 'Ethics and responsible AI specialist.',
    tone: 'Thoughtful, balanced, and practical.',
    personaPrompt:
      'You are Eva, an expert in AI ethics and responsible AI. Focus on bias, fairness, transparency, privacy, regulation, oversight, and societal impact. Redirect deep implementation questions back to Theo or the guide.',
    config: {
      scope:
        'Responsible AI topics: bias, fairness, transparency, privacy, regulation, oversight, environmental impact, and societal consequences.',
    },
  },
]

function readSeedSlug(config: Record<string, unknown>): string | null {
  const value = config['seedSlug']
  return typeof value === 'string' && value.length > 0 ? value : null
}

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
    objectives: aiGuidedDiscoveryScenarioConfig.objectives ?? [],
    worldContext: aiGuidedDiscoveryScenarioConfig.worldContext ?? '',
    avatarAvailability: aiGuidedDiscoveryScenarioConfig.avatarAvailability ?? {
      initialAvatarIds: [],
    },
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
      existingScenario !== undefined
        ? await scenarioRepository.update(
            existingScenario.scenarioId,
            aiGuidedDiscoveryScenarioConfig,
          )
        : await scenarioRepository.create(aiGuidedDiscoveryScenarioConfig)

    const existingAvatars = await avatarRepository.listByScenarioId(scenario.scenarioId)
    const existingAvatarsBySlug = new Map(
      existingAvatars.flatMap((avatar) => {
        const slug = readSeedSlug(avatar.config)
        return slug !== null ? [[slug, avatar]] : []
      }),
    )

    for (const definition of aiGuidedDiscoveryAvatarDefinitions) {
      const avatarSeed = toCreateAvatarParams(definition, scenario.scenarioId)
      const seedWithSlug: CreateAvatarParams = {
        ...avatarSeed,
        config: {
          ...avatarSeed.config,
          seedSlug: definition.slug,
        },
      }

      const existingAvatar = existingAvatarsBySlug.get(definition.slug)
      if (existingAvatar !== undefined) {
        await avatarRepository.update(existingAvatar.avatarId, seedWithSlug)
        continue
      }

      await avatarRepository.create({
        ...seedWithSlug,
        scenarioId: scenario.scenarioId,
      })
    }

    const avatars = await avatarRepository.listByScenarioId(scenario.scenarioId)
    const avatarBySlug = new Map(
      avatars.flatMap((avatar) => {
        const slug = readSeedSlug(avatar.config)
        return slug !== null ? [[slug, avatar.avatarId]] : []
      }),
    )
    const initialAvatarIds = aiGuidedDiscoveryAvatarDefinitions
      .filter((definition) => definition.slug === 'guide')
      .map((definition) => avatarBySlug.get(definition.slug))
      .filter((avatarId): avatarId is string => typeof avatarId === 'string')
    const unlockableAvatarIds = aiGuidedDiscoveryAvatarDefinitions
      .filter((definition) => definition.slug !== 'guide')
      .map((definition) => avatarBySlug.get(definition.slug))
      .filter((avatarId): avatarId is string => typeof avatarId === 'string')

    await scenarioRepository.update(scenario.scenarioId, {
      avatarAvailability: {
        initialAvatarIds,
        unlockableAvatarIds,
      },
    })

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
