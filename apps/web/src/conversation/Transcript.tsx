import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  ActiveChatRuntimeState,
  ChatThreadAvatarDraft,
  ChatThreadMessage,
} from '../chat/use-active-chat-runtime'
import type { AudioPlaybackState } from '../chat/use-message-audio-playback'

/** Cleaned conversation messages with per-reply audio controls. */
export function Transcript({ chat }: { chat: ActiveChatRuntimeState }): JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="chat-thread" id="conversation-transcript">
      {chat.messages.length === 0 ? <p className="muted">{t('chat.noMessages')}</p> : null}
      {chat.messages.map((message) => (
        <ChatBubble key={message.localId} message={message} audio={chat.audio} chat={chat} />
      ))}
      {chat.avatarDraft !== null ? <AvatarDraftBubble draft={chat.avatarDraft} /> : null}
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
