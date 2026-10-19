import type { JSX } from 'react'
import type { AvailableAvatarSummary } from '@gami/shared'
import { resolveMediaUrl } from '../media/media-url'

type PortraitProps = {
  avatar: Pick<AvailableAvatarSummary, 'name' | 'presentation'>
  size: 'card' | 'stage'
}

/**
 * On the conversation stage, the authored idle loop (muted, looping); otherwise the portrait, or
 * the character's initial when none is authored.
 */
export function Portrait({ avatar, size }: PortraitProps): JSX.Element {
  const portrait = avatar.presentation?.portrait
  const idleLoop = avatar.presentation?.idleLoop
  if (size === 'stage' && idleLoop !== undefined) {
    return (
      <video
        className={`portrait portrait-${size}`}
        src={resolveMediaUrl(idleLoop.url)}
        {...(portrait !== undefined ? { poster: resolveMediaUrl(portrait.url) } : {})}
        aria-label={avatar.name}
        autoPlay
        muted
        loop
        playsInline
      />
    )
  }
  if (portrait !== undefined) {
    return (
      <img
        className={`portrait portrait-${size}`}
        src={resolveMediaUrl(portrait.url)}
        alt={avatar.name}
        loading="lazy"
      />
    )
  }
  return (
    <span
      className={`portrait portrait-${size} portrait-placeholder`}
      role="img"
      aria-label={avatar.name}
    >
      {avatar.name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
