import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { PublicMediaAsset } from '@gami/shared'
import { resolveMediaUrl } from './media-url'

export type MediaEndOutcome = 'completed' | 'skipped' | 'failed'

type FullscreenVideoProps = {
  asset: PublicMediaAsset
  onStarted?: () => void
  onEnd: (outcome: MediaEndOutcome) => void
}

/**
 * A video over the whole screen with skip and mute. Playback starts on mount (the visitor's last
 * gesture usually allows sound); when the browser blocks it, a tap-to-play button appears. Focus
 * moves into the player and returns to where it was afterwards.
 */
export function FullscreenVideo({ asset, onStarted, onEnd }: FullscreenVideoProps): JSX.Element {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)
  const [blocked, setBlocked] = useState(false)
  const [muted, setMuted] = useState(false)
  const endedRef = useRef(false)
  const end = (outcome: MediaEndOutcome): void => {
    if (endedRef.current) return
    endedRef.current = true
    onEnd(outcome)
  }

  useEffect(() => {
    const previous = document.activeElement
    skipRef.current?.focus()
    void play(videoRef.current, setBlocked)
    return () => {
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])

  return (
    <div
      className="media-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label={asset.description}
    >
      <video
        ref={videoRef}
        className="media-video"
        src={resolveMediaUrl(asset.url)}
        {...(asset.posterUrl !== undefined ? { poster: resolveMediaUrl(asset.posterUrl) } : {})}
        playsInline
        muted={muted}
        onPlaying={() => {
          setBlocked(false)
          onStarted?.()
        }}
        onEnded={() => {
          end('completed')
        }}
        onError={() => {
          end('failed')
        }}
      />
      {blocked ? (
        <button
          type="button"
          className="button-primary media-tap-to-play"
          onClick={() => void play(videoRef.current, setBlocked)}
        >
          {t('media.tapToPlay')}
        </button>
      ) : null}
      <div className="media-controls">
        <button
          type="button"
          className="button-secondary"
          aria-pressed={muted}
          onClick={() => {
            setMuted((value) => !value)
          }}
        >
          {muted ? t('media.unmute') : t('media.mute')}
        </button>
        <button
          ref={skipRef}
          type="button"
          className="button-secondary"
          onClick={() => {
            videoRef.current?.pause()
            end('skipped')
          }}
        >
          {t('media.skip')}
        </button>
      </div>
    </div>
  )
}

async function play(
  video: HTMLVideoElement | null,
  setBlocked: (blocked: boolean) => void,
): Promise<void> {
  if (video === null) return
  try {
    await video.play()
  } catch {
    setBlocked(true)
  }
}
