import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { AvailableAvatarSummary, MediaCueDisplay } from '@gami/shared'
import type { ActiveChatRuntimeState } from '../chat/use-active-chat-runtime'
import { StoryCard } from '../flow/StoryScreens'
import { useVoiceConversation, type VoiceConversationState } from '../voice/use-voice-conversation'
import { IdleHint } from '../moments/IdleHint'
import { pickIdleHint, useIdleHint } from '../moments/use-idle-hint'
import { getConversationPresence, type ConversationPresence } from './conversation-presence'
import { Portrait } from './Portrait'
import { TextComposer } from './TextComposer'
import { Transcript } from './Transcript'

type ConversationScreenProps = {
  avatar: Pick<AvailableAvatarSummary, 'name' | 'presentation'>
  chat: ActiveChatRuntimeState
  onSwitch: () => void
  /** A staged runtime moment; while shown, no idle hint is counted. */
  notice: ReactNode
  /** Scenario media on screen: the microphone pauses, and a fullscreen video blocks typing. */
  watching: MediaCueDisplay | null
  /** Reports whether the microphone hears the visitor, so media waits for them to finish. */
  onVisitorSpeaking?: (speaking: boolean) => void
}

export function ConversationScreen({
  avatar,
  chat,
  onSwitch,
  notice,
  watching,
  onVisitorSpeaking,
}: ConversationScreenProps): JSX.Element {
  const { t } = useTranslation()
  const voice = useVoiceConversation(chat, watching !== null)
  useReportVisitorSpeaking(voice.hearing, onVisitorSpeaking)
  const voiceAvailable = voice.supported && voice.error === null
  const [showTranscript, setShowTranscript] = useState(!voice.supported)
  useStopVoiceWithoutConversation(chat, voice)
  useEffect(() => {
    if (voice.error !== null) setShowTranscript(true)
  }, [voice.error])

  const presence = getConversationPresence({
    hasConversation: chat.conversation !== null,
    conversationStatus: chat.conversationStatus,
    sendStatus: chat.sendStatus,
    audioStatus: chat.audio.status,
    voicePhase: voice.phase,
    watching: watching !== null,
  })
  const caption = showTranscript ? null : latestReply(chat)

  return (
    <StoryCard titleId="conversation-title">
      <div className="conversation-stage">
        <Portrait avatar={avatar} size="stage" />
        <h1 id="conversation-title">{avatar.name}</h1>
        <p className={`presence presence-${presence}`} role="status" aria-live="polite">
          {t(`presence.${presence}`)}
        </p>
      </div>
      {caption !== null ? <p className="conversation-caption">{caption}</p> : null}
      {notice}
      <ConversationIdleHint
        avatar={avatar}
        chat={chat}
        voice={voice}
        presence={presence}
        paused={notice !== null || watching !== null}
      />
      {chat.conversationError !== null ? (
        <p className="error" role="alert">
          {chat.conversationError}
        </p>
      ) : null}
      {voiceAvailable ? <MicButton voice={voice} disabled={chat.conversation === null} /> : null}
      <VoiceHint voice={voice} />
      <TextComposer chat={chat} voice={voice} disabled={watching === 'fullscreen'} />
      <button
        type="button"
        className="button-link"
        aria-expanded={showTranscript}
        aria-controls="conversation-transcript"
        onClick={() => {
          setShowTranscript((value) => !value)
        }}
      >
        {showTranscript ? t('conversation.hideTranscript') : t('conversation.showTranscript')}
      </button>
      {showTranscript ? <Transcript chat={chat} /> : null}
      <div className="story-actions">
        <button type="button" className="button-secondary" onClick={onSwitch}>
          {t('conversation.switch')}
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={!chat.canEndConversation}
          onClick={chat.endCurrentConversation}
        >
          {t('chat.endConversation')}
        </button>
      </div>
    </StoryCard>
  )
}

function MicButton({
  voice,
  disabled,
}: {
  voice: VoiceConversationState
  disabled: boolean
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      className={
        voice.enabled ? 'button-primary mic-button mic-button-on' : 'button-primary mic-button'
      }
      aria-pressed={voice.enabled}
      disabled={disabled}
      onClick={() => {
        if (voice.enabled) voice.stop()
        else voice.start()
      }}
    >
      {voice.enabled ? t('chat.voice.stop') : t('chat.voice.start')}
    </button>
  )
}

/** Explains why voice is unavailable, or what the microphone is doing beyond the presence state. */
function VoiceHint({ voice }: { voice: VoiceConversationState }): JSX.Element | null {
  const { t } = useTranslation()
  if (!voice.supported || voice.error === 'unsupported') {
    return <p className="voice-hint">{t('chat.voice.unsupported')}</p>
  }
  if (voice.error === 'permission-denied' || voice.error === 'failed') {
    return (
      <p className="error" role="alert">
        {t(voice.error === 'failed' ? 'chat.voice.failed' : 'chat.voice.permissionDenied')}
      </p>
    )
  }
  if (voice.enabled && voice.phase === 'off') {
    return <p className="voice-hint">{t('chat.voice.starting')}</p>
  }
  if (voice.phase === 'listening' && voice.hearing) {
    return <p className="voice-hint">{t('chat.voice.hearing')}</p>
  }
  return null
}

function useReportVisitorSpeaking(
  hearing: boolean,
  onVisitorSpeaking: ((speaking: boolean) => void) | undefined,
): void {
  useEffect(() => {
    onVisitorSpeaking?.(hearing)
  }, [hearing, onVisitorSpeaking])
  useEffect(() => () => onVisitorSpeaking?.(false), [onVisitorSpeaking])
}

/** Ending or switching away from the conversation also ends the voice loop. */
function useStopVoiceWithoutConversation(
  chat: ActiveChatRuntimeState,
  voice: VoiceConversationState,
): void {
  const hasConversation = chat.conversation !== null
  const { enabled, stop } = voice
  useEffect(() => {
    if (!hasConversation && enabled) stop()
  }, [hasConversation, enabled, stop])
}

function latestReply(chat: ActiveChatRuntimeState): string | null {
  if (chat.avatarDraft !== null && chat.avatarDraft.content.length > 0) {
    return chat.avatarDraft.content
  }
  const reply = [...chat.messages].reverse().find((message) => message.role === 'avatar')
  return reply?.content ?? null
}

type ConversationIdleHintProps = {
  avatar: Pick<AvailableAvatarSummary, 'name' | 'presentation'>
  chat: ActiveChatRuntimeState
  voice: VoiceConversationState
  presence: ConversationPresence
  paused: boolean
}

/** Offers an unused starter question when the visitor stays silent on their turn. */
function ConversationIdleHint({
  avatar,
  chat,
  voice,
  presence,
  paused,
}: ConversationIdleHintProps): JSX.Element | null {
  const idle = useIdleHint({
    enabled: !paused && (presence === 'yourTurn' || presence === 'listening'),
    activityKey: `${String(chat.messages.length)}|${chat.composerValue}|${String(voice.hearing)}`,
  })
  if (!idle) return null
  const asked = chat.messages.filter((message) => message.role === 'user').map((m) => m.content)
  return (
    <IdleHint
      avatarName={avatar.name}
      question={pickIdleHint(avatar.presentation?.starterQuestions ?? [], asked)}
      onAsk={chat.sendMessage}
    />
  )
}
