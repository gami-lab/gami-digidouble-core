import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AvailableAvatarSummary, RuntimeEvent } from '@gami/shared'
import type { ActiveChatRuntimeState } from '../chat/use-active-chat-runtime'
import { MomentBanner } from './MomentBanner'
import {
  createRuntimeMomentsState,
  dismissMoment,
  receiveRuntimeEvent,
  visibleMoment,
} from './runtime-moments'

export type RuntimeMoments = {
  onRuntimeEvent: (event: RuntimeEvent) => void
  /** Renders the moment to show now; `onTalk` runs after the switch to that character starts. */
  render: (onTalk: () => void) => ReactNode
}

export function useRuntimeMoments(
  sessionId: string | null,
  avatars: AvailableAvatarSummary[],
  chat: ActiveChatRuntimeState,
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
  }
}
