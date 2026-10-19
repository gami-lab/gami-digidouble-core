// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicMediaAsset } from '@gami/shared'
import '../i18n'
import { FullscreenVideo } from './FullscreenVideo'
import { DEFAULT_IMAGE_OVERLAY_MS, ImageOverlay } from './ImageOverlay'

const video: PublicMediaAsset = {
  assetId: 'media_intro',
  kind: 'video',
  url: '/v1/media/media_intro',
  posterUrl: '/v1/media/media_poster',
  description: 'Arrival at the chalet',
}
const image: PublicMediaAsset = {
  assetId: 'media_map',
  kind: 'image',
  url: 'https://cdn.example.com/map.png',
  description: 'The harbor map',
}

const play = vi.fn<() => Promise<void>>()

beforeEach(() => {
  play.mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('FullscreenVideo', () => {
  it('plays the resolved asset, moves focus to Skip, and reports a skip once', async () => {
    const onEnd = vi.fn()
    render(<FullscreenVideo asset={video} onEnd={onEnd} />)
    await act(async () => {
      await Promise.resolve()
    })

    const dialog = screen.getByRole('dialog', { name: 'Arrival at the chalet' })
    const element = dialog.querySelector('video')
    expect(element?.getAttribute('src')).toBe('http://localhost:3000/v1/media/media_intro')
    expect(element?.getAttribute('poster')).toBe('http://localhost:3000/v1/media/media_poster')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Skip' }))

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    if (element !== null) fireEvent.ended(element)

    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith('skipped')
  })

  it('offers tap-to-play when the browser blocks autoplay', async () => {
    play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    const onStarted = vi.fn()
    render(<FullscreenVideo asset={video} onStarted={onStarted} onEnd={vi.fn()} />)
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Tap to play' }))
    const element = screen.getByRole('dialog').querySelector('video')
    if (element !== null) fireEvent.playing(element)

    expect(play).toHaveBeenCalledTimes(2)
    expect(onStarted).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Tap to play' })).toBeNull()
  })

  it('reports completion and a failed load', () => {
    const onEnd = vi.fn()
    render(<FullscreenVideo asset={video} onEnd={onEnd} />)
    const element = screen.getByRole('dialog').querySelector('video')
    if (element !== null) fireEvent.error(element)

    expect(onEnd).toHaveBeenCalledWith('failed')
  })
})

describe('ImageOverlay', () => {
  it('shows the image with its description as alt text and closes on request', () => {
    const onEnd = vi.fn()
    render(<ImageOverlay asset={image} onStarted={vi.fn()} onEnd={onEnd} />)

    expect(screen.getByRole('img', { name: 'The harbor map' }).getAttribute('src')).toBe(
      'https://cdn.example.com/map.png',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onEnd).toHaveBeenCalledWith('skipped')
  })

  it('dismisses itself after the asset duration or the default', () => {
    vi.useFakeTimers()
    const onEnd = vi.fn()
    render(<ImageOverlay asset={image} onStarted={vi.fn()} onEnd={onEnd} />)

    act(() => {
      vi.advanceTimersByTime(DEFAULT_IMAGE_OVERLAY_MS)
    })
    expect(onEnd).toHaveBeenCalledWith('completed')
  })
})
