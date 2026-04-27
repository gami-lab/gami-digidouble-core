import type { Dispatch, JSX, SetStateAction, SyntheticEvent } from 'react'
import type { ConversationSummary, Message } from '../api'
import {
  avatarMessageStyle,
  chatComposerStyle,
  chatInputStyle,
  messageListStyle,
  sendButtonStyle,
  userMessageStyle,
} from '../pages/session-styles'

type ScenarioChatPanelProps = {
  conversation: ConversationSummary | null
  messages: Message[]
  draftMessage: string
  isSending: boolean
  isLoadingHistory: boolean
  onSendDraft: (event: SyntheticEvent<HTMLFormElement>) => void
  onDraftChange: Dispatch<SetStateAction<string>>
}

export function ScenarioChatPanel({
  conversation,
  messages,
  draftMessage,
  isSending,
  isLoadingHistory,
  onSendDraft,
  onDraftChange,
}: ScenarioChatPanelProps): JSX.Element {
  if (conversation === null) {
    return (
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          padding: '20px',
          textAlign: 'center',
          color: '#9ca3af',
          backgroundColor: '#f9fafb',
        }}
      >
        Select an avatar to start chatting.
      </div>
    )
  }

  return (
    <div>
      <div style={messageListStyle}>
        {isLoadingHistory ? (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>Loading history...</p>
        ) : null}
        {messages.length === 0 && !isLoadingHistory ? (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>No messages yet.</p>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.messageId}
            style={message.role === 'user' ? userMessageStyle : avatarMessageStyle}
          >
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '3px' }}>
              {message.role} - {new Date(message.createdAt).toLocaleTimeString()}
            </div>
            <div style={{ fontSize: '14px' }}>{message.content}</div>
          </div>
        ))}
      </div>
      <form onSubmit={onSendDraft} style={chatComposerStyle}>
        <input
          type="text"
          value={draftMessage}
          style={chatInputStyle}
          placeholder="Type a message..."
          disabled={isSending}
          onChange={(event) => {
            onDraftChange(event.target.value)
          }}
        />
        <button
          type="submit"
          style={sendButtonStyle}
          disabled={isSending || draftMessage.trim() === ''}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
