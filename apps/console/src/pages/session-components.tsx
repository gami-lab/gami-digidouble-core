import type { ComponentProps, JSX } from 'react'
import type {
  AvatarSummary,
  ConversationSummary,
  Message,
  ScenarioSummary,
  SessionSummary,
} from '../api'
import { LabeledInput } from '../components/LabeledInput'
import { buttonStyle, errorStyle, inputStyle, labelStyle, sectionStyle } from './form-styles'
import type { SessionPageController } from './session-controller'

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

const listContainerStyle = {
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  padding: '10px',
  backgroundColor: '#f9fafb',
}

const cardStyle = {
  marginTop: '8px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  padding: '10px',
}

const userMessageStyle = {
  marginTop: '8px',
  borderRadius: '8px',
  padding: '8px 10px',
  maxWidth: '95%',
  backgroundColor: '#e5e7eb',
  alignSelf: 'flex-end',
  textAlign: 'right' as const,
}

const avatarMessageStyle = {
  marginTop: '8px',
  borderRadius: '8px',
  padding: '8px 10px',
  maxWidth: '95%',
  backgroundColor: '#dbeafe',
  alignSelf: 'flex-start',
}

type StartSessionSectionProps = {
  scenario: ScenarioSummary
  userId: string
  isStartingSession: boolean
  error: string | null
  knownSessions?: SessionSummary[]
  onUserIdChange: (value: string) => void
  onSubmit: (event: FormSubmitEvent) => void
  onSelectSession?: (sessionId: string) => void
}

export function StartSessionSection({
  scenario,
  userId,
  isStartingSession,
  error,
  knownSessions = [],
  onUserIdChange,
  onSubmit,
  onSelectSession,
}: StartSessionSectionProps): JSX.Element {
  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Session</h2>
      <p style={{ marginTop: 0, color: '#4b5563' }}>Scenario: {scenario.name}</p>

      {knownSessions.length > 0 ? (
        <>
          <h3 style={{ marginTop: '16px' }}>Recent sessions</h3>
          {knownSessions.map((session) => (
            <div
              key={session.sessionId}
              style={{
                ...cardStyle,
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ fontSize: '13px' }}>
                <strong>Session:</strong> {session.sessionId}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                User: {session.userId} · Status: {session.status}
              </div>
              <button
                type="button"
                style={{ ...buttonStyle, marginTop: '6px', alignSelf: 'flex-start' }}
                onClick={() => {
                  onSelectSession?.(session.sessionId)
                }}
              >
                Resume session
              </button>
            </div>
          ))}
          <h3 style={{ marginTop: '24px' }}>Start new session</h3>
        </>
      ) : null}

      <form onSubmit={onSubmit}>
        <fieldset style={{ margin: 0, padding: 0, border: 'none' }} disabled={isStartingSession}>
          <LabeledInput
            id="session-user-id"
            label="User ID"
            value={userId}
            onChange={onUserIdChange}
            required
            style={inputStyle}
            labelStyle={labelStyle}
          />
          <button
            type="submit"
            style={buttonStyle}
            disabled={isStartingSession || userId.trim() === ''}
          >
            {isStartingSession ? 'Starting…' : 'Start Session'}
          </button>
        </fieldset>
      </form>

      {error !== null ? <p style={errorStyle}>{error}</p> : null}
    </section>
  )
}

type SessionDetailSectionProps = {
  scenario: ScenarioSummary
  controller: SessionPageController
  avatarsById: Map<string, AvatarSummary>
}

export function SessionDetailSection({
  scenario,
  controller,
  avatarsById,
}: SessionDetailSectionProps): JSX.Element {
  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Session detail</h2>
      {controller.isLoadingSession ? <p>Loading session state…</p> : null}
      {controller.state.session !== null ? (
        <SessionMetadata session={controller.state.session} avatarsById={avatarsById} />
      ) : null}

      <ConversationStarter
        scenario={scenario}
        avatars={controller.avatars}
        selectedAvatarId={controller.selectedAvatarId}
        label={controller.startConversationButtonLabel}
        isLoadingAvatars={controller.isLoadingAvatars}
        isStartingConversation={controller.isStartingConversation}
        onSelectedAvatarChange={controller.setSelectedAvatarId}
        onStartConversation={controller.handleStartConversation}
      />

      <ConversationList
        conversations={controller.state.conversations}
        selectedConversationId={controller.state.selectedConversationId}
        isLoadingConversation={controller.isLoadingConversation}
        avatarsById={avatarsById}
        onOpenConversation={controller.openPreviousConversation}
      />

      {controller.selectedConversation !== null ? (
        <ConversationDetail
          conversation={controller.selectedConversation}
          avatar={avatarsById.get(controller.selectedConversation.avatarId) ?? null}
          messages={controller.selectedMessages}
          draftMessage={controller.draftMessage}
          isLoadingConversation={controller.isLoadingConversation}
          isSendingMessage={controller.isSendingMessage}
          onDraftMessageChange={controller.setDraftMessage}
          onSubmit={controller.handleSendMessageSubmit}
        />
      ) : (
        <p style={{ color: '#6b7280' }}>Choose a conversation to inspect its message history.</p>
      )}

      {controller.submitError !== null ? <p style={errorStyle}>{controller.submitError}</p> : null}
    </section>
  )
}

type SessionMetadataProps = {
  session: SessionSummary
  avatarsById: Map<string, AvatarSummary>
}

function SessionMetadata({ session, avatarsById }: SessionMetadataProps): JSX.Element {
  const activeAvatar =
    session.activeAvatarId === undefined ? null : avatarsById.get(session.activeAvatarId)

  return (
    <div style={listContainerStyle}>
      <div>
        <strong>Session ID:</strong> {session.sessionId}
      </div>
      <div>
        <strong>Scenario ID:</strong> {session.scenarioId}
      </div>
      <div>
        <strong>User ID:</strong> {session.userId}
      </div>
      <div>
        <strong>Status:</strong> {session.status}
      </div>
      <div>
        <strong>Started:</strong> {session.startedAt}
      </div>
      <div>
        <strong>Last activity:</strong> {session.lastActivityAt}
      </div>
      <div>
        <strong>Current active avatar:</strong>{' '}
        {session.activeAvatarId === undefined
          ? 'none'
          : `${activeAvatar?.name ?? 'Unknown avatar'} (${session.activeAvatarId})`}
      </div>
    </div>
  )
}

type ConversationStarterProps = {
  scenario: ScenarioSummary
  avatars: AvatarSummary[]
  selectedAvatarId: string | null
  label: string
  isLoadingAvatars: boolean
  isStartingConversation: boolean
  onSelectedAvatarChange: (value: string | null) => void
  onStartConversation: () => void
}

function ConversationStarter({
  scenario,
  avatars,
  selectedAvatarId,
  label,
  isLoadingAvatars,
  isStartingConversation,
  onSelectedAvatarChange,
  onStartConversation,
}: ConversationStarterProps): JSX.Element {
  return (
    <>
      <h3>Start conversation</h3>
      <p style={{ marginTop: 0, color: '#4b5563' }}>
        Opening a previous conversation keeps that old thread. Starting again with the same avatar
        creates a new conversation.
      </p>
      <div>
        <label style={labelStyle} htmlFor="conversation-avatar-select">
          Avatar for scenario {scenario.name}
        </label>
        <select
          id="conversation-avatar-select"
          style={inputStyle}
          disabled={isLoadingAvatars || avatars.length === 0 || isStartingConversation}
          value={selectedAvatarId ?? ''}
          onChange={(event) => {
            onSelectedAvatarChange(event.target.value.length === 0 ? null : event.target.value)
          }}
        >
          <option value="">Select avatar</option>
          {avatars.map((avatar) => (
            <option key={avatar.avatarId} value={avatar.avatarId}>
              {avatar.name} ({avatar.avatarId})
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        style={buttonStyle}
        disabled={selectedAvatarId === null || isStartingConversation || isLoadingAvatars}
        onClick={onStartConversation}
      >
        {isStartingConversation ? 'Starting…' : label}
      </button>
    </>
  )
}

type ConversationListProps = {
  conversations: ConversationSummary[]
  selectedConversationId: string | null
  isLoadingConversation: boolean
  avatarsById: Map<string, AvatarSummary>
  onOpenConversation: (conversation: ConversationSummary) => void
}

function ConversationList({
  conversations,
  selectedConversationId,
  isLoadingConversation,
  avatarsById,
  onOpenConversation,
}: ConversationListProps): JSX.Element {
  return (
    <>
      <h3>Session conversations</h3>
      <div style={listContainerStyle}>
        {conversations.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280' }}>No conversations yet.</p>
        ) : null}
        {conversations.map((conversation) => {
          const avatar = avatarsById.get(conversation.avatarId)
          const isSelected = conversation.conversationId === selectedConversationId

          return (
            <div
              key={conversation.conversationId}
              style={{ ...cardStyle, backgroundColor: isSelected ? '#eff6ff' : '#ffffff' }}
            >
              <div>
                <strong>{avatar?.name ?? 'Unknown avatar'}</strong> · {conversation.status}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Conversation ID: {conversation.conversationId}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Avatar ID: {conversation.avatarId}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Started: {conversation.startedAt}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Last activity: {conversation.lastActivityAt}
              </div>
              <button
                type="button"
                style={{ ...buttonStyle, marginTop: '8px' }}
                disabled={isLoadingConversation}
                onClick={() => {
                  onOpenConversation(conversation)
                }}
              >
                {isSelected
                  ? 'Open previous conversation (selected)'
                  : 'Open previous conversation'}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

type ConversationDetailProps = {
  conversation: ConversationSummary
  avatar: AvatarSummary | null
  messages: Message[]
  draftMessage: string
  isLoadingConversation: boolean
  isSendingMessage: boolean
  onDraftMessageChange: (value: string) => void
  onSubmit: (event: FormSubmitEvent) => void
}

function ConversationDetail({
  conversation,
  avatar,
  messages,
  draftMessage,
  isLoadingConversation,
  isSendingMessage,
  onDraftMessageChange,
  onSubmit,
}: ConversationDetailProps): JSX.Element {
  return (
    <>
      <h3>Conversation detail</h3>
      <div style={listContainerStyle}>
        <div>
          <strong>Conversation ID:</strong> {conversation.conversationId}
        </div>
        <div>
          <strong>Avatar:</strong> {avatar?.name ?? 'Unknown avatar'} ({conversation.avatarId})
        </div>
        <div>
          <strong>Started:</strong> {conversation.startedAt}
        </div>
      </div>

      <h4 style={{ marginBottom: '8px' }}>Message history (this conversation only)</h4>
      {isLoadingConversation ? <p>Loading conversation history…</p> : null}
      <div
        style={{
          ...listContainerStyle,
          minHeight: '180px',
          maxHeight: '340px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 ? (
          <p style={{ margin: 0, color: '#6b7280' }}>No messages yet.</p>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.messageId}
            style={message.role === 'user' ? userMessageStyle : avatarMessageStyle}
          >
            <div>
              <strong>{message.role}</strong> · {message.createdAt}
            </div>
            <div>{message.content}</div>
          </div>
        ))}
      </div>
      <p style={{ marginTop: '8px', color: '#6b7280', fontSize: '12px' }}>
        Runtime debugging is centralized in Scenario Test Bench → Session Runtime Inspector.
      </p>

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <input
          type="text"
          value={draftMessage}
          onChange={(event) => {
            onDraftMessageChange(event.target.value)
          }}
          style={inputStyle}
          placeholder="Type a message"
          disabled={isSendingMessage}
        />
        <button
          type="submit"
          style={{ ...buttonStyle, marginTop: 0, minWidth: '120px' }}
          disabled={isSendingMessage || draftMessage.trim() === ''}
        >
          {isSendingMessage ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </>
  )
}
