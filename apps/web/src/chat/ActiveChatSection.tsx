import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { AvailableAvatarSummary } from '@gami/shared'
import type {
  ActiveChatRuntimeState,
  ChatThreadAvatarDraft,
  ChatThreadMessage,
} from './use-active-chat-runtime'

type ActiveChatSectionProps = {
  avatars: AvailableAvatarSummary[]
  chat: ActiveChatRuntimeState
}

export function ActiveChatSection({ avatars, chat }: ActiveChatSectionProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <section className="chat-section" aria-labelledby="chat-title">
      <h2 id="chat-title">{t('chat.title')}</h2>
      <ChatEntryPanel avatars={avatars} chat={chat} />
      <ChatThreadPanel chat={chat} />
      <ChatComposer chat={chat} />
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
        <ChatBubble key={message.localId} message={message} />
      ))}
      {chat.avatarDraft !== null ? <AvatarDraftBubble draft={chat.avatarDraft} /> : null}
      {chat.sendStatus === 'streaming' && chat.avatarDraft === null ? <TypingIndicator /> : null}
    </div>
  )
}

function ChatBubble({ message }: { message: ChatThreadMessage }): JSX.Element {
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
    </article>
  )
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

function ChatComposer({ chat }: { chat: ActiveChatRuntimeState }): JSX.Element {
  const { t } = useTranslation()

  if (chat.conversation === null) {
    return <></>
  }

  return (
    <div className="chat-composer">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          chat.sendCurrentMessage()
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
        <button type="submit" className="button-primary" disabled={!chat.canSend}>
          {chat.sendStatus === 'streaming' ? t('chat.sending') : t('chat.send')}
        </button>
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
