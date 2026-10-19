import { describe, expect, it } from 'vitest'
import { MEDIA_LIMITS } from '@gami/shared'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { InMemoryMediaAssetRepository } from '../../../infrastructure/db/in-memory-media-asset.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemoryMediaStorage } from '../../../infrastructure/media/in-memory-media-storage.js'
import { PNG_BYTES } from '../../../test-utils/media.js'
import { UploadMediaAssetUseCase } from './upload-media-asset.use-case.js'

const scenario: Scenario = {
  scenarioId: 'scenario_1',
  name: 'House',
  status: 'draft',
  objectives: [],
  worldContext: '',
  avatarAvailability: { initialAvatarIds: [] },
  config: {},
  createdAt: '2026-10-19T10:00:00.000Z',
  updatedAt: '2026-10-19T10:00:00.000Z',
}

async function* chunks(...parts: Uint8Array[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) {
    await Promise.resolve()
    yield part
  }
}

function makeUseCase() {
  const storage = new InMemoryMediaStorage()
  const assets = new InMemoryMediaAssetRepository()
  const useCase = new UploadMediaAssetUseCase(
    new InMemoryScenarioRepository([scenario]),
    assets,
    storage,
  )
  return { useCase, storage, assets }
}

const baseInput = {
  scenarioId: 'scenario_1',
  contentType: 'image/png',
  description: 'An image',
  cueable: false,
}

describe('UploadMediaAssetUseCase', () => {
  it('checks the signature across small chunks and stores every byte', async () => {
    const { useCase, storage } = makeUseCase()

    const asset = await useCase.execute({
      ...baseInput,
      content: chunks(PNG_BYTES.subarray(0, 3), PNG_BYTES.subarray(3, 5), PNG_BYTES.subarray(5)),
    })

    expect(asset.byteSize).toBe(PNG_BYTES.byteLength)
    expect(storage.has(asset.assetId.replace('media_', ''))).toBe(true)
  })

  it('stops a stream that grows past the kind limit and keeps nothing', async () => {
    const { useCase, assets } = makeUseCase()
    const big = new Uint8Array(MEDIA_LIMITS.maxUploadBytes.image)

    await expect(
      useCase.execute({ ...baseInput, content: chunks(PNG_BYTES, big) }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    await expect(assets.listByScenario('scenario_1')).resolves.toEqual([])
  })

  it('rejects an empty or truncated file', async () => {
    const { useCase } = makeUseCase()

    await expect(useCase.execute({ ...baseInput, content: chunks() })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
    await expect(
      useCase.execute({ ...baseInput, content: chunks(PNG_BYTES.subarray(0, 4)) }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('normalises the MIME parameters away', async () => {
    const { useCase } = makeUseCase()

    const asset = await useCase.execute({
      ...baseInput,
      contentType: 'IMAGE/PNG; charset=binary',
      content: chunks(PNG_BYTES),
    })

    expect(asset.mimeType).toBe('image/png')
  })
})
