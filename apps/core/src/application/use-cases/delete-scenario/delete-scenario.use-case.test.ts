import { Readable } from 'node:stream'
import type { MediaAsset } from '../../../domain/media/media-asset.types.js'
import { describe, expect, it } from 'vitest'
import type { Session } from '../../../domain/conversation/session.types.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { DeleteScenarioUseCase } from './delete-scenario.use-case.js'
import { InMemoryMediaAssetRepository } from '../../../infrastructure/db/in-memory-media-asset.repository.js'
import { InMemoryMediaStorage } from '../../../infrastructure/media/in-memory-media-storage.js'

const closedSession: Session = {
  sessionId: 'session_1',
  userId: 'user_1',
  scenarioId: 'scenario_1',
  unlockedAvatarIds: [],
  status: 'closed',
  startedAt: '2026-04-21T08:00:00.000Z',
  lastActivityAt: '2026-04-21T08:00:00.000Z',
  endedAt: '2026-04-21T08:30:00.000Z',
}

const storedAsset: MediaAsset = {
  assetId: 'media_stored-file',
  scenarioId: 'scenario_1',
  kind: 'image',
  source: 'upload',
  storageKey: 'stored-file',
  url: null,
  mimeType: 'image/png',
  byteSize: 3,
  posterAssetId: null,
  durationMs: null,
  description: 'A file',
  cueable: false,
  createdAt: '2026-04-21T08:00:00.000Z',
  updatedAt: '2026-04-21T08:00:00.000Z',
}

function makeUseCase(
  scenarios: InMemoryScenarioRepository,
  avatars: InMemoryAvatarRepository,
  sessions: InMemorySessionRepository,
  assets = new InMemoryMediaAssetRepository(),
  storage = new InMemoryMediaStorage(),
): DeleteScenarioUseCase {
  return new DeleteScenarioUseCase(scenarios, avatars, sessions, assets, storage)
}

describe('DeleteScenarioUseCase', () => {
  it('returns 404 when scenario is missing', async () => {
    const useCase = makeUseCase(
      new InMemoryScenarioRepository(),
      new InMemoryAvatarRepository(),
      new InMemorySessionRepository(),
    )

    await expect(useCase.execute({ scenarioId: 'scenario_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('returns 409 when scenario still has avatars', async () => {
    const useCase = makeUseCase(
      new InMemoryScenarioRepository([
        {
          scenarioId: 'scenario_1',
          name: 'Scenario',
          status: 'active',
          objectives: [],
          worldContext: '',
          avatarAvailability: { initialAvatarIds: [] },
          config: {},
          createdAt: '2026-04-21T08:00:00.000Z',
          updatedAt: '2026-04-21T08:00:00.000Z',
        },
      ]),
      new InMemoryAvatarRepository([
        {
          avatarId: 'avatar_1',
          scenarioId: 'scenario_1',
          name: 'Ava',
          status: 'active',
          personaPrompt: 'You are Ava.',
          config: {},
          createdAt: '2026-04-21T08:10:00.000Z',
          updatedAt: '2026-04-21T08:10:00.000Z',
        },
      ]),
      new InMemorySessionRepository(),
    )

    await expect(useCase.execute({ scenarioId: 'scenario_1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('returns 409 when scenario still has sessions', async () => {
    const useCase = makeUseCase(
      new InMemoryScenarioRepository([
        {
          scenarioId: 'scenario_1',
          name: 'Scenario',
          status: 'active',
          objectives: [],
          worldContext: '',
          avatarAvailability: { initialAvatarIds: [] },
          config: {},
          createdAt: '2026-04-21T08:00:00.000Z',
          updatedAt: '2026-04-21T08:00:00.000Z',
        },
      ]),
      new InMemoryAvatarRepository(),
      new InMemorySessionRepository([closedSession]),
    )

    await expect(useCase.execute({ scenarioId: 'scenario_1' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('deletes scenario when it has no avatars and no sessions', async () => {
    const scenarioRepository = new InMemoryScenarioRepository([
      {
        scenarioId: 'scenario_1',
        name: 'Scenario',
        status: 'active',
        objectives: [],
        worldContext: '',
        avatarAvailability: { initialAvatarIds: [] },
        config: {},
        createdAt: '2026-04-21T08:00:00.000Z',
        updatedAt: '2026-04-21T08:00:00.000Z',
      },
    ])
    const storage = new InMemoryMediaStorage()
    await storage.put('stored-file', Readable.from([Uint8Array.of(1, 2, 3)]))
    const useCase = makeUseCase(
      scenarioRepository,
      new InMemoryAvatarRepository(),
      new InMemorySessionRepository(),
      new InMemoryMediaAssetRepository([storedAsset]),
      storage,
    )

    const result = await useCase.execute({ scenarioId: 'scenario_1' })

    expect(result).toEqual({ scenarioId: 'scenario_1', deleted: true })
    await expect(scenarioRepository.findById('scenario_1')).resolves.toBeNull()
    expect(storage.has('stored-file')).toBe(false)
  })
})
