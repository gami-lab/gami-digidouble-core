import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AvailableAvatarSummary, MediaCueDisplay, RuntimeEvent } from '@gami/shared'
import { reportMediaPlayback } from '../api/media-cues'
import type { ActiveChatRuntimeState } from '../chat/use-active-chat-runtime'
import { FullscreenVideo, type MediaEndOutcome } from '../media/FullscreenVideo'
import { ImageOverlay } from '../media/ImageOverlay'
import { MomentBanner } from './MomentBanner'
import {
  createRuntimeMomentsState,
  currentMediaMoment,
  dismissMoment,
  finishMedia,
  markMediaStarted,
  receiveRuntimeEvent,
  visibleMoment,
  type MediaMoment,
} from './runtime-moments'

export type RuntimeMoments = {
  onRuntimeEvent: (event: RuntimeEvent) => void
  /** Renders the moment to show now; `onTalk` runs after the switch to that character starts. */
  render: (onTalk: () => void) => ReactNode
  /** The media cue playing over the experience, if any. */
  renderMedia: () => ReactNode
  /** How the playing cue is displayed; voice and presence pause while it is not null. */
  watching: MediaCueDisplay | null
}

export function useRuntimeMoments(
  sessionId: string | null,
  avatars: AvailableAvatarSummary[],
  chat: ActiveChatRuntimeState,
  /** The microphone hears the visitor: a cue waits so it never cuts their sentence off. */
  visitorSpeaking: boolean,
): RuntimeMoments {
  const [state, setState] = useState(() => createRuntimeMomentsState(sessionId))
  useEffect(() => {
    setState((current) =>
      current.sessionId === sessionId ? current : createRuntimeMomentsState(sessionId),
    )
  }, [sessionId])
  const onRuntimeEvent = useCallback((event: RuntimeEvent) => {
    setState((current) => receiveRuntimeEvent(current, event))
  }, [])

  const busy =
    chat.sendStatus === 'streaming' ||
    chat.audio.status === 'loading' ||
    chat.audio.status === 'playing'
  const moment = visibleMoment(state, {
    busy,
    activeAvatarId: chat.activeAvatarId,
    availableAvatarIds: avatars.map((avatar) => avatar.avatarId),
  })
  const avatar = avatars.find((item) => item.avatarId === moment?.avatarId)
  const media = useMediaCuePlayback(
    sessionId,
    currentMediaMoment(state, { busy: busy || visitorSpeaking }),
    setState,
  )
  useDismissOverlayOnSend(media.moment, chat.sendStatus === 'streaming', media.end)

  return {
    onRuntimeEvent,
    render: (onTalk) =>
      moment === null || avatar === undefined ? null : (
        <MomentBanner
          moment={moment}
          avatar={avatar}
          onDismiss={() => {
            setState((current) => dismissMoment(current, moment.momentId))
          }}
          onTalk={() => {
            setState((current) => dismissMoment(current, moment.momentId))
            chat.startChatWithAvatar(avatar.avatarId)
            onTalk()
          }}
        />
      ),
    renderMedia: () => {
      if (media.moment === null) return null
      const { cue } = media.moment
      return cue.asset.kind === 'video' ? (
        <FullscreenVideo
          key={cue.cueId}
          asset={cue.asset}
          onStarted={media.start}
          onEnd={media.end}
        />
      ) : (
        <ImageOverlay key={cue.cueId} asset={cue.asset} onStarted={media.start} onEnd={media.end} />
      )
    },
    watching: media.moment?.cue.display ?? null,
  }
}

type MediaCuePlayback = {
  moment: MediaMoment | null
  start: () => void
  end: (outcome: MediaEndOutcome) => void
}

/** Reports `started` once and one terminal outcome per cue, then moves to the next cue. */
function useMediaCuePlayback(
  sessionId: string | null,
  moment: MediaMoment | null,
  setState: (
    update: (
      state: ReturnType<typeof createRuntimeMomentsState>,
    ) => ReturnType<typeof createRuntimeMomentsState>,
  ) => void,
): MediaCuePlayback {
  const momentRef = useRef(moment)
  momentRef.current = moment
  const startedCueRef = useRef<string | null>(null)
  const start = useCallback(() => {
    const current = momentRef.current
    if (current === null || startedCueRef.current === current.cue.cueId || sessionId === null) {
      return
    }
    startedCueRef.current = current.cue.cueId
    setState((state) => markMediaStarted(state, current.cue.cueId))
    void reportMediaPlayback(
      sessionId,
      current.cue.cueId,
      'started',
      Date.now() - current.receivedAt,
    )
  }, [sessionId, setState])
  const end = useCallback(
    (outcome: MediaEndOutcome) => {
      const current = momentRef.current
      if (current === null) return
      momentRef.current = null
      setState((state) => finishMedia(state, current.cue.cueId))
      if (sessionId !== null) {
        void reportMediaPlayback(
          sessionId,
          current.cue.cueId,
          outcome,
          Date.now() - current.receivedAt,
        )
      }
    },
    [sessionId, setState],
  )
  return { moment, start, end }
}

/** An image never covers a reply: sending a message dismisses it. */
function useDismissOverlayOnSend(
  moment: MediaMoment | null,
  sending: boolean,
  end: (outcome: MediaEndOutcome) => void,
): void {
  const overlayShown = moment?.started === true && moment.cue.display === 'overlay'
  useEffect(() => {
    if (overlayShown && sending) end('skipped')
  }, [overlayShown, sending, end])
}
