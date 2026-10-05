import { useEffect } from 'react'
import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { AvailableAvatarSummary } from '@gami/shared'
import type {
  ActiveChatRuntimeState,
  ChatThreadAvatarDraft,
  ChatThreadMessage,
} from './use-active-chat-runtime'
import type { AudioPlaybackState } from './use-message-audio-playback'
import { useVoiceConversation, type VoiceConversationState } from '../voice/use-voice-conversation'

type ActiveChatSectionProps = {
  avatars: AvailableAvatarSummary[]
  chat: ActiveChatRuntimeState
}

export function ActiveChatSection({ avatars, chat }: ActiveChatSectionProps): JSX.Element {
  const { t } = useTranslation()
  const voice = useVoiceConversation(chat)
  const hasConversation = chat.conversation !== null
  const { enabled: voiceEnabled, stop: stopVoice } = voice

  // Ending or switching away from the conversation also ends the voice loop.
  useEffect(() => {
    if (!hasConversation && voiceEnabled) stopVoice()
  }, [hasConversation, voiceEnabled, stopVoice])

  return (
    <section className="chat-section" aria-labelledby="chat-title">
      <h2 id="chat-title">{t('chat.title')}</h2>
      <ChatEntryPanel avatars={avatars} chat={chat} />
      <ChatThreadPanel chat={chat} />
      <ChatComposer chat={chat} voice={voice} />
    </section>
  )
}

type ChatEntryPanelProps = {
  avatars: AvailableAvatarSummary[]
  chat: ActiveChatRuntimeState
}

function ChatEntryPanel({ avatars, chat }: ChatEntryPanelProps): JSX.Element {
  const { t } = useTranslation()

  if (avatars.length === 0) {
    return <p className="muted">{t('chat.noAvatars')}</p>
  }

  return (
    <div className="chat-entry-panel">
      <p className="muted">{t('chat.pickAvatar')}</p>
      <div className="chat-avatar-list" role="list" aria-label={t('chat.avatarsAriaLabel')}>
        {avatars.map((avatar) => {
          const isActive = avatar.avatarId === chat.activeAvatarId
          const isStarting = chat.conversationStatus === 'starting' && isActive
          const className = isActive
            ? 'chat-avatar-button chat-avatar-button-active'
            : 'chat-avatar-button'

          return (
            <button
              key={avatar.avatarId}
              type="button"
              className={className}
              onClick={() => {
                chat.startChatWithAvatar(avatar.avatarId)
              }}
            >
              <span>{avatar.name}</span>
              <span className="chat-avatar-button-meta">
                {isStarting
                  ? t('chat.starting')
                  : isActive
                    ? t('chat.currentThread')
                    : t('chat.startChat')}
              </span>
            </button>
          )
        })}
      </div>
      {chat.conversationError !== null ? <p className="error">{chat.conversationError}</p> : null}
    </div>
  )
}

function ChatThreadPanel({ chat }: { chat: ActiveChatRuntimeState }): JSX.Element {
  const { t } = useTranslation()

  if (chat.conversation === null) {
    return <p className="muted">{t('chat.selectAvatar')}</p>
  }

  return (
    <div className="chat-thread" aria-live="polite">
      {chat.messages.length === 0 ? <p className="muted">{t('chat.noMessages')}</p> : null}
      {chat.messages.map((message) => (
        <ChatBubble key={message.localId} message={message} audio={chat.audio} chat={chat} />
      ))}
      {chat.avatarDraft !== null ? <AvatarDraftBubble draft={chat.avatarDraft} /> : null}
      {chat.sendStatus === 'streaming' && chat.avatarDraft === null ? <TypingIndicator /> : null}
    </div>
  )
}

function ChatBubble({
  message,
  audio,
  chat,
}: {
  message: ChatThreadMessage
  audio: AudioPlaybackState
  chat: ActiveChatRuntimeState
}): JSX.Element {
  const { t } = useTranslation()
  const isUser = message.role === 'user'
  const className = isUser ? 'chat-bubble chat-bubble-user' : 'chat-bubble chat-bubble-avatar'

  return (
    <article className={className}>
      <p className="chat-bubble-content">{message.content}</p>
      <p className="chat-bubble-meta">
        {new Date(message.createdAt).toLocaleTimeString()}
        {message.pending === true ? t('chat.meta.sending') : ''}
        {message.failed === true ? t('chat.meta.failed') : ''}
      </p>
      {message.role === 'avatar' && message.pending !== true ? (
        <MessageAudioControl messageId={message.localId} audio={audio} chat={chat} />
      ) : null}
    </article>
  )
}

function MessageAudioControl({
  messageId,
  audio,
  chat,
}: {
  messageId: string
  audio: AudioPlaybackState
  chat: ActiveChatRuntimeState
}): JSX.Element {
  const { t } = useTranslation()
  const isCurrent = audio.messageId === messageId
  const status = isCurrent ? audio.status : 'idle'
  const label = status === 'loading' ? t('chat.audio.loading') : getAudioButtonLabel(status, t)
  const isPlaying = status === 'playing'

  return (
    <div className="chat-audio-control">
      <button
        type="button"
        className="button-secondary chat-audio-button"
        disabled={status === 'loading' || status === 'unsupported'}
        aria-label={label}
        aria-busy={status === 'loading'}
        onClick={() => {
          if (isPlaying) {
            chat.stopMessageAudio()
          } else {
            chat.playMessageAudio(messageId)
          }
        }}
      >
        {status === 'loading' ? t('chat.audio.loading') : label}
      </button>
      {isCurrent && status !== 'idle' ? (
        <span className="chat-audio-status" role="status" aria-live="polite">
          {getAudioStatusMessage(status, t)}
        </span>
      ) : null}
    </div>
  )
}

function getAudioButtonLabel(
  status: AudioPlaybackState['status'],
  translate: ReturnType<typeof useTranslation>['t'],
): string {
  switch (status) {
    case 'playing':
      return translate('chat.audio.stop')
    case 'stopped':
    case 'failed':
      return translate('chat.audio.replay')
    default:
      return translate('chat.audio.play')
  }
}

function getAudioStatusMessage(
  status: AudioPlaybackState['status'],
  translate: ReturnType<typeof useTranslation>['t'],
): string {
  switch (status) {
    case 'loading':
      return translate('chat.audio.loading')
    case 'playing':
      return translate('chat.audio.playing')
    case 'stopped':
      return translate('chat.audio.stopped')
    case 'unsupported':
      return translate('chat.audio.unsupported')
    case 'failed':
      return translate('chat.audio.failed')
    default:
      return ''
  }
}

function TypingIndicator(): JSX.Element {
  const { t } = useTranslation()
  return <p className="muted">{t('chat.avatarResponding')}</p>
}

function AvatarDraftBubble({ draft }: { draft: ChatThreadAvatarDraft }): JSX.Element {
  const { t } = useTranslation()

  return (
    <article className="chat-bubble chat-bubble-avatar" aria-label={t('chat.avatarDraft')}>
      <p className="chat-bubble-content">{draft.content || '…'}</p>
      <p className="chat-bubble-meta">
        {new Date(draft.createdAt).toLocaleTimeString()}
        {t('chat.meta.streaming')}
      </p>
    </article>
  )
}

function ChatComposer({
  chat,
  voice,
}: {
  chat: ActiveChatRuntimeState
  voice: VoiceConversationState
}): JSX.Element {
  const { t } = useTranslation()

  if (chat.conversation === null) {
    return <></>
  }

  const hasText = chat.composerValue.trim().length > 0

  return (
    <div className="chat-composer">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          // Typed text wins; otherwise Send submits what the microphone heard so far.
          if (hasText || !voice.submitNow()) chat.sendCurrentMessage()
        }}
      >
        <label className="field">
          <span>{t('chat.message.label')}</span>
          <textarea
            value={chat.composerValue}
            onChange={(event) => {
              chat.setComposerValue(event.target.value)
            }}
            rows={3}
            placeholder={t('chat.message.placeholder')}
          />
        </label>
        {chat.sendError !== null ? <p className="error">{chat.sendError}</p> : null}
        <div className="chat-composer-actions">
          <button type="submit" className="button-primary" disabled={!chat.canSend}>
            {chat.sendStatus === 'streaming' ? t('chat.sending') : t('chat.send')}
          </button>
          <button
            type="button"
            className={
              voice.enabled ? 'button-secondary chat-voice-button-active' : 'button-secondary'
            }
            aria-pressed={voice.enabled}
            onClick={() => {
              if (voice.enabled) voice.stop()
              else voice.start()
            }}
          >
            {voice.enabled ? t('chat.voice.stop') : t('chat.voice.start')}
          </button>
        </div>
        <VoiceStatus voice={voice} />
      </form>
      <button
        type="button"
        className="button-secondary"
        disabled={!chat.canEndConversation}
        onClick={() => {
          chat.endCurrentConversation()
        }}
      >
        {t('chat.endConversation')}
      </button>
    </div>
  )
}

function VoiceStatus({ voice }: { voice: VoiceConversationState }): JSX.Element | null {
  const { t } = useTranslation()
  const message = getVoiceStatusMessage(voice, t)
  if (message === null) return null
  return (
    <p className={voice.error === null ? 'chat-voice-status' : 'error'} role="status">
      {message}
    </p>
  )
}

function getVoiceStatusMessage(
  voice: VoiceConversationState,
  translate: ReturnType<typeof useTranslation>['t'],
): string | null {
  if (voice.error === 'unsupported') return translate('chat.voice.unsupported')
  if (voice.error === 'permission-denied') return translate('chat.voice.permissionDenied')
  if (voice.error === 'failed') return translate('chat.voice.failed')
  switch (voice.phase) {
    case 'off':
      // Enabled but not capturing yet: the browser is asking for microphone permission.
      return voice.enabled ? translate('chat.voice.starting') : null
    case 'listening':
      return voice.hearing ? translate('chat.voice.hearing') : translate('chat.voice.listening')
    case 'waiting':
      return translate('chat.voice.waiting')
    case 'speaking':
      return translate('chat.voice.speaking')
  }
}
