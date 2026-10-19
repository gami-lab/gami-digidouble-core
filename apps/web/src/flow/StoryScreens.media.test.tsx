// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicMediaAsset, PublicScenarioSummary } from '@gami/shared'
import '../i18n'
import { Portrait } from '../conversation/Portrait'
import { IntroScreen, OutroScreen } from './StoryScreens'

const introVideo: PublicMediaAsset = {
  assetId: 'media_intro',
  kind: 'video',
  url: '/v1/media/media_intro',
  description: 'Arrival',
}
const still: PublicMediaAsset = {
  assetId: 'media_still',
  kind: 'image',
  url: '/v1/media/media_still',
  description: 'The house',
}

function scenario(
  presentation: NonNullable<PublicScenarioSummary['presentation']>,
): PublicScenarioSummary {
  return { scenarioId: 'scenario_1', name: 'House', presentation }
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('intro and outro media slots', () => {
  it('plays the intro video, then shows the intro text after a skip', async () => {
    const onNext = vi.fn()
    render(
      <IntroScreen
        scenario={scenario({ introMedia: introVideo, introText: 'The doors close.' })}
        onNext={onNext}
      />,
    )
    await act(async () => {
      await Promise.resolve()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(screen.getByText('The doors close.')).not.toBeNull()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('continues the flow when the intro video ends and there is no intro text', () => {
    const onNext = vi.fn()
    render(<IntroScreen scenario={scenario({ introMedia: introVideo })} onNext={onNext} />)

    const video = screen.getByRole('dialog', { name: 'Arrival' }).querySelector('video')
    if (video !== null) fireEvent.ended(video)

    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('shows an intro image in place of the cover, and falls back to the cover without media', () => {
    const { container, unmount } = render(
      <IntroScreen scenario={scenario({ introMedia: still, cover: introVideo })} onNext={vi.fn()} />,
    )
    expect(container.querySelector('.story-cover')?.getAttribute('src')).toContain('media_still')
    unmount()

    const fallback = render(
      <IntroScreen scenario={scenario({ cover: still, introText: 'Text' })} onNext={vi.fn()} />,
    )
    expect(fallback.container.querySelector('.story-cover')?.getAttribute('src')).toContain(
      'media_still',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('plays the outro video before the outro text and restart button', () => {
    render(<OutroScreen scenario={scenario({ outroMedia: introVideo })} onNext={vi.fn()} />)

    const video = screen.getByRole('dialog', { name: 'Arrival' }).querySelector('video')
    if (video !== null) fireEvent.ended(video)

    expect(screen.getByRole('button', { name: 'Start again' })).not.toBeNull()
  })
})

describe('conversation idle loop', () => {
  it('loops the idle video muted on the stage and keeps the portrait on cards', () => {
    const avatar = {
      name: 'Ava',
      presentation: {
        portrait: still,
        idleLoop: { ...introVideo, assetId: 'media_idle', url: '/v1/media/media_idle' },
      },
    }
    const { container } = render(
      <>
        <Portrait avatar={avatar} size="stage" />
        <Portrait avatar={avatar} size="card" />
      </>,
    )

    const loop = container.querySelector<HTMLVideoElement>('video.portrait-stage')
    expect(loop?.getAttribute('src')).toContain('media_idle')
    expect(loop?.muted).toBe(true)
    expect(loop?.loop).toBe(true)
    expect(container.querySelector('img.portrait-card')?.getAttribute('src')).toContain('media_still')
  })
})
