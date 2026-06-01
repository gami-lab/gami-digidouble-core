import type { JSX } from 'react'
import type { AvailableAvatarSummary } from '@gami/shared'
import type { ActiveChatRuntimeState, ChatThreadMessage } from './use-active-chat-runtime'

type ActiveChatSectionProps = {
  avatars: AvailableAvatarSummary[]
  chat: ActiveChatRuntimeState
}

export function ActiveChatSection({ avatars, chat }: ActiveChatSectionProps): JSX.Element {
  return (
    <section className="chat-section" aria-labelledby="chat-title">
      <h2 id="chat-title">Current chat</h2>
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
  if (avatars.length === 0) {
    return <p className="muted">No available avatars yet. Chat unlocks will appear here.</p>
  }

  return (
    <div className="chat-entry-panel">
      <p className="muted">Pick one available avatar to start a single active thread.</p>
      <div className="chat-avatar-list" role="list" aria-label="Available chat avatars">
        {avatars.map((avatar) => {
          const isActive = avatar.avatarId === chat.activeAvatarId
          const isStarting = chat.conversationStatus === 'starting' && isActive
          const className = isActive ? 'chat-avatar-button chat-avatar-button-active' : 'chat-avatar-button'

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
                {isStarting ? 'Starting chat…' : isActive ? 'Current thread' : 'Start chat'}
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
  if (chat.conversation === null) {
    return <p className="muted">Select an avatar to open your current thread.</p>
  }

  return (
    <div className="chat-thread" aria-live="polite">
      {chat.messages.length === 0 ? <p className="muted">No messages yet. Send the first one.</p> : null}
      {chat.messages.map((message) => (
        <ChatBubble key={message.localId} message={message} />
      ))}
      {chat.sendStatus === 'sending' ? <TypingIndicator /> : null}
    </div>
  )
}

function ChatBubble({ message }: { message: ChatThreadMessage }): JSX.Element {
  const isUser = message.role === 'user'
  const className = isUser ? 'chat-bubble chat-bubble-user' : 'chat-bubble chat-bubble-avatar'

  return (
    <article className={className}>
      <p className="chat-bubble-content">{message.content}</p>
      <p className="chat-bubble-meta">
        {new Date(message.createdAt).toLocaleTimeString()}
        {message.pending === true ? ' · sending…' : ''}
        {message.failed === true ? ' · failed' : ''}
      </p>
    </article>
  )
}

function TypingIndicator(): JSX.Element {
  return <p className="muted">Avatar is responding…</p>
}

function ChatComposer({ chat }: { chat: ActiveChatRuntimeState }): JSX.Element {
  if (chat.conversation === null) {
    return <></>
  }

  return (
    <form
      className="chat-composer"
      onSubmit={(event) => {
        event.preventDefault()
        chat.sendCurrentMessage()
      }}
    >
      <label className="field">
        <span>Message</span>
        <textarea
          value={chat.composerValue}
          onChange={(event) => {
            chat.setComposerValue(event.target.value)
          }}
          rows={3}
          placeholder="Write your message..."
        />
      </label>
      {chat.sendError !== null ? <p className="error">{chat.sendError}</p> : null}
      <button type="submit" className="button-primary" disabled={!chat.canSend}>
        {chat.sendStatus === 'sending' ? 'Sending…' : 'Send'}
      </button>
    </form>
  )
}
