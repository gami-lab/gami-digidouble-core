// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiError, type MediaAssetSummary } from '@gami/shared'
import {
  createUrlMediaAsset,
  deleteMediaAsset,
  listMediaAssets,
  updateMediaAsset,
  uploadMediaAsset,
} from '../api/media'
import { readVideoMetadata } from './browser-media'
import { MediaLibrary } from './MediaLibrary'
import { MediaPicker } from './MediaPicker'

vi.mock('../api/media', () => ({
  listMediaAssets: vi.fn(),
  createUrlMediaAsset: vi.fn(),
  uploadMediaAsset: vi.fn(),
  updateMediaAsset: vi.fn(),
  deleteMediaAsset: vi.fn(),
  mediaSrc: (asset: { previewUrl: string }) => `http://core.test${asset.previewUrl}`,
}))

vi.mock('./browser-media', () => ({ readVideoMetadata: vi.fn() }))

function asset(overrides: Partial<MediaAssetSummary> & { assetId: string }): MediaAssetSummary {
  return {
    scenarioId: 'scenario_1',
    kind: 'image',
    source: 'upload',
    mimeType: 'image/png',
    byteSize: 2048,
    url: null,
    fileUrl: `/v1/media/${overrides.assetId}`,
    previewUrl: `/v1/admin/media/${overrides.assetId}/file`,
    posterAssetId: null,
    durationMs: null,
    description: 'The hall at night',
    cueable: false,
    createdAt: '2026-10-19T00:00:00.000Z',
    updatedAt: '2026-10-19T00:00:00.000Z',
    ...overrides,
  }
}

const hall = asset({ assetId: 'media_hall' })
const intro = asset({
  assetId: 'media_intro',
  kind: 'video',
  mimeType: 'video/mp4',
  description: 'Arrival at the chalet',
  durationMs: 30_000,
})

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listMediaAssets).mockResolvedValue([hall])
})

function renderLibrary(): void {
  render(<MediaLibrary scenarioId="scenario_1" onClose={vi.fn()} />)
}

function describeAs(text: string): void {
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: text } })
}

describe('media library', () => {
  it('lists assets with a preview, size, and the cue-able toggle', async () => {
    vi.mocked(updateMediaAsset).mockResolvedValue({ ...hall, cueable: true })
    renderLibrary()

    const item = await screen.findByRole('listitem', { name: 'The hall at night' })
    expect(item.textContent).toContain('2 KB')
    expect(screen.getByRole('img', { name: 'The hall at night' }).getAttribute('src')).toBe(
      'http://core.test/v1/admin/media/media_hall/file',
    )
    fireEvent.click(screen.getByLabelText('Cue-able by the Game Master'))

    await waitFor(() => {
      expect(updateMediaAsset).toHaveBeenCalledWith('media_hall', { cueable: true })
    })
  })

  it('links a URL asset with its type and description', async () => {
    vi.mocked(createUrlMediaAsset).mockResolvedValue(intro)
    renderLibrary()
    await screen.findByRole('listitem', { name: 'The hall at night' })

    fireEvent.click(screen.getByLabelText('Link a URL'))
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://cdn.test/a.mp4' } })
    describeAs('Arrival at the chalet')
    fireEvent.click(screen.getByLabelText('The Game Master may cue this during conversations'))
    fireEvent.click(screen.getByRole('button', { name: 'Add media' }))

    await screen.findByRole('listitem', { name: 'Arrival at the chalet' })
    expect(createUrlMediaAsset).toHaveBeenCalledWith('scenario_1', {
      url: 'https://cdn.test/a.mp4',
      mimeType: 'video/mp4',
      description: 'Arrival at the chalet',
      cueable: true,
    })
  })

  it('uploads a video after its poster frame, with the duration read in the browser', async () => {
    const poster = asset({ assetId: 'media_poster', description: 'Poster frame: Arrival' })
    vi.mocked(readVideoMetadata).mockResolvedValue({
      durationMs: 30_000,
      poster: new Blob(['jpeg'], { type: 'image/jpeg' }),
    })
    vi.mocked(uploadMediaAsset).mockResolvedValueOnce(poster).mockResolvedValueOnce(intro)
    renderLibrary()
    await screen.findByRole('listitem', { name: 'The hall at night' })

    const file = new File(['video'], 'intro.mp4', { type: 'video/mp4' })
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } })
    describeAs('Arrival')
    fireEvent.click(screen.getByRole('button', { name: 'Add media' }))

    await screen.findByRole('listitem', { name: 'Arrival at the chalet' })
    expect(uploadMediaAsset).toHaveBeenNthCalledWith(
      2,
      'scenario_1',
      { file, description: 'Arrival', cueable: false, posterAssetId: 'media_poster', durationMs: 30_000 },
      expect.any(Function),
    )
  })

  it('refuses an unsupported file before upload', async () => {
    renderLibrary()
    await screen.findByRole('listitem', { name: 'The hall at night' })

    const file = new File(['gif'], 'a.gif', { type: 'image/gif' })
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } })
    describeAs('A gif')

    expect(screen.getByText('image/gif is not supported.')).not.toBeNull()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add media' }).disabled).toBe(true)
  })

  it('shows why a referenced asset cannot be deleted', async () => {
    vi.mocked(deleteMediaAsset).mockRejectedValue(
      createApiError({ code: 'CONFLICT', message: 'Media asset is in use: scenario cover.' }),
    )
    renderLibrary()
    await screen.findByRole('listitem', { name: 'The hall at night' })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText(/in use: scenario cover/)).not.toBeNull()
    expect(screen.getByRole('listitem', { name: 'The hall at night' })).not.toBeNull()
  })
})

describe('media picker', () => {
  it('offers only assets whose kind the slot accepts', () => {
    render(
      <MediaPicker
        id="cover"
        label="Cover"
        value={undefined}
        assets={[hall, intro]}
        kinds={['image']}
        disabled={false}
        onChange={vi.fn()}
      />,
    )

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toHaveLength(2)
    expect(options[1]).toContain('The hall at night')
  })
})
