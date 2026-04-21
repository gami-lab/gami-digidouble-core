import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, CSSProperties, JSX } from 'react'
import { getHistory, resetSession, sendMessage, startSession } from '../api'
import { formatApiError } from '../api/error'
import { LabeledInput } from '../components/LabeledInput'
import { buttonStyle, errorStyle, inputStyle, labelStyle, sectionStyle } from './form-styles'

type SessionPageProps = {
  scenarioId: string
  avatarId: string
  sessionId: string | null
  onSessionIdChange: (sessionId: string | null) => void
}

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

type LocalMessage = {
  id: string
  role: 'user' | 'avatar'
  content: string
  metadata?: {
    model?: string
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
  }
}

const chatHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  marginBottom: '12px',
}

const messageListStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  minHeight: '260px',
  maxHeight: '360px',
  overflowY: 'auto',
  padding: '10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  backgroundColor: '#f9fafb',
}

const userMessageStyle: CSSProperties = {
  alignSelf: 'flex-end',
  backgroundColor: '#e5e7eb',
  borderRadius: '8px',
  padding: '8px 10px',
  maxWidth: '85%',
  textAlign: 'right',
}

const avatarMessageStyle: CSSProperties = {
  alignSelf: 'flex-start',
  backgroundColor: '#dbeafe',
  borderRadius: '8px',
  padding: '8px 10px',
  maxWidth: '85%',
}

const chatComposerStyle: CSSProperties = {
  marginTop: '12px',
  display: 'flex',
  gap: '8px',
}

const chatInputStyle: CSSProperties = {
  ...inputStyle,
  marginTop: 0,
}

const resetButtonStyle: CSSProperties = {
  ...buttonStyle,
  marginTop: 0,
  padding: '8px 12px',
}

const sendButtonStyle: CSSProperties = {
  ...buttonStyle,
  marginTop: 0,
  minWidth: '88px',
}

const pendingMessageId = 'pending-avatar-message'

const toLocalMessageId = (): string =>
  `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const mapHistoryToLocalMessages = (history: Awaited<ReturnType<typeof getHistory>>): LocalMessage[] =>
  history.messages
    .filter((message) => message.role === 'user' || message.role === 'avatar')
    .map((message) => ({
      id: message.messageId,
      role: message.role,
      content: message.content,
      metadata:
        message.role === 'avatar'
          ? {
              model: message.metadata?.model,
              latencyMs: message.metadata?.latencyMs,
              inputTokens: message.metadata?.inputTokens,
              outputTokens: message.metadata?.outputTokens,
            }
          : undefined,
    }))

export function SessionPage({
  scenarioId,
  avatarId,
  sessionId,
  onSessionIdChange,
}: SessionPageProps): JSX.Element {
  const [userId, setUserId] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [isResettingSession, setIsResettingSession] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const messageBottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messageBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleStartSession = async (): Promise<void> => {
    setSubmitError(null)
    setIsStartingSession(true)
    try {
      const startedSession = await startSession({ scenarioId, userId })
      onSessionIdChange(startedSession.sessionId)

      const history = await getHistory(startedSession.sessionId)
      setMessages(mapHistoryToLocalMessages(history))
    } catch (error) {
      setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to start session'))
    } finally {
      setIsStartingSession(false)
    }
  }

  const handleSendMessage = async (): Promise<void> => {
    if (sessionId === null || draftMessage.trim().length === 0 || isSendingMessage) {
      return
    }

    const content = draftMessage.trim()
    const optimisticMessage: LocalMessage = {
      id: toLocalMessageId(),
      role: 'user',
      content,
    }
    const pendingMessage: LocalMessage = { id: pendingMessageId, role: 'avatar', content: '…' }

    setSubmitError(null)
    setDraftMessage('')
    setIsSendingMessage(true)
    setMessages((current) => [...current, optimisticMessage, pendingMessage])

    try {
      const response = await sendMessage(sessionId, { avatarId, message: { content } })
      const avatarMessage: LocalMessage = {
        id: response.avatarMessage.messageId,
        role: 'avatar',
        content: response.avatarMessage.content,
        metadata: {
          model: response.avatarMessage.metadata.model,
          latencyMs: response.avatarMessage.metadata.latencyMs,
          inputTokens: response.avatarMessage.metadata.inputTokens,
          outputTokens: response.avatarMessage.metadata.outputTokens,
        },
      }

      setMessages((current) =>
        current.map((message) => (message.id === pendingMessageId ? avatarMessage : message)),
      )
    } catch (error) {
      setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to send message'))
      setMessages((current) => current.filter((message) => message.id !== pendingMessageId))
    } finally {
      setIsSendingMessage(false)
    }
  }

  const handleResetSession = async (): Promise<void> => {
    if (sessionId === null) {
      return
    }

    setSubmitError(null)
    setIsResettingSession(true)
    try {
      await resetSession(sessionId)
      setMessages([])
      onSessionIdChange(null)
    } catch (error) {
      setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to reset session'))
    } finally {
      setIsResettingSession(false)
    }
  }

  const handleStartSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    void handleStartSession()
  }

  const handleSendSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    void handleSendMessage()
  }

  if (sessionId === null) {
    return (
      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Start Session</h2>
        <p style={{ marginTop: 0, color: '#4b5563' }}>Scenario: {scenarioId}</p>

        <form onSubmit={handleStartSubmit}>
          <fieldset
            style={{ margin: 0, padding: 0, border: 'none' }}
            disabled={isStartingSession || isResettingSession}
          >
            <LabeledInput
              id="session-user-id"
              label="User ID"
              value={userId}
              onChange={setUserId}
              required
              style={inputStyle}
              labelStyle={labelStyle}
            />

            <button type="submit" style={buttonStyle} disabled={isStartingSession || userId.trim() === ''}>
              {isStartingSession ? 'Starting…' : 'Start Session'}
            </button>
          </fieldset>
        </form>

        {submitError !== null && <p style={errorStyle}>{submitError}</p>}
      </section>
    )
  }

  return (
    <section style={sectionStyle}>
      <div style={chatHeaderStyle}>
        <strong>Session: {sessionId}</strong>
        <button
          type="button"
          style={resetButtonStyle}
          disabled={isResettingSession || isSendingMessage}
          onClick={() => {
            void handleResetSession()
          }}
        >
          {isResettingSession ? 'Resetting…' : 'Reset'}
        </button>
      </div>

      <div style={messageListStyle}>
        {messages.map((message) => (
          <div key={message.id} style={message.role === 'user' ? userMessageStyle : avatarMessageStyle}>
            <strong>{message.role === 'user' ? 'You:' : 'Avatar:'}</strong> {message.content}
          </div>
        ))}
        <div ref={messageBottomRef} />
      </div>

      <form onSubmit={handleSendSubmit} style={chatComposerStyle}>
        <input
          type="text"
          value={draftMessage}
          onChange={(event) => {
            setDraftMessage(event.target.value)
          }}
          style={chatInputStyle}
          placeholder="Type a message"
          disabled={isSendingMessage || isResettingSession}
        />
        <button
          type="submit"
          style={sendButtonStyle}
          disabled={isSendingMessage || isResettingSession || draftMessage.trim() === ''}
        >
          {isSendingMessage ? 'Sending…' : 'Send'}
        </button>
      </form>

      {submitError !== null && <p style={errorStyle}>{submitError}</p>}
    </section>
  )
}
