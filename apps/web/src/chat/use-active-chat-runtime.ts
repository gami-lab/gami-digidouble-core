import { useRef, useState } from 'react'
import type { ConversationSummary, Message, SessionSummary } from '@gami/shared'
import { sendMessage, startConversation } from '../api/conversations'

type ConversationStatus = 'idle' | 'starting' | 'ready' | 'error'
type SendStatus = 'idle' | 'sending'

export type ChatThreadMessage = {
  localId: string
  role: Message['role']
  content: string
  createdAt: string
  pending?: true
  failed?: true
}

export type ChatThreadState = {
  activeAvatarId: string | null
  conversation: ConversationSummary | null
  conversationStatus: ConversationStatus
  conversationError: string | null
  messages: ChatThreadMessage[]
  composerValue: string
  sendStatus: SendStatus
  sendError: string | null
}

export type OptimisticSendState = {
  composerValue: string
  sendStatus: SendStatus
  sendError: string | null
  messages: ChatThreadMessage[]
}

export type ActiveChatRuntimeState = {
  activeAvatarId: string | null
  conversation: ConversationSummary | null
  conversationStatus: ConversationStatus
  conversationError: string | null
  messages: ChatThreadMessage[]
  composerValue: string
  sendStatus: SendStatus
  sendError: string | null
  canSend: boolean
  setComposerValue: (value: string) => void
  startChatWithAvatar: (avatarId: string) => void
  sendCurrentMessage: () => void
}

export function useActiveChatRuntime(session: SessionSummary | null): ActiveChatRuntimeState {
  const [activeAvatarId, setActiveAvatarId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationSummary | null>(null)
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>('idle')
  const [conversationError, setConversationError] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatThreadMessage[]>([])
  const [composerValue, setComposerValue] = useState('')
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [sendError, setSendError] = useState<string | null>(null)

  const conversationRequestIdRef = useRef(0)

  function startChatWithAvatar(avatarId: string): void {
    if (session === null) {
      setConversationStatus('error')
      setConversationError('Session unavailable. Please select a scenario again.')
      return
    }

    conversationRequestIdRef.current += 1
    const requestId = conversationRequestIdRef.current

    const nextThreadState = createThreadStateForAvatarSelection(avatarId)
    applyThreadState(nextThreadState, {
      setActiveAvatarId,
      setConversation,
      setConversationStatus,
      setConversationError,
      setMessages,
      setComposerValue,
      setSendStatus,
      setSendError,
    })

    void createConversation(session.sessionId, avatarId, requestId, {
      setConversation,
      setConversationStatus,
      setConversationError,
      conversationRequestIdRef,
    })
  }

  function sendCurrentMessage(): void {
    if (conversation === null || sendStatus === 'sending') {
      return
    }

    const content = composerValue.trim()
    if (content.length === 0) {
      return
    }

    const runId = conversationRequestIdRef.current
    const pendingMessageId = `pending-${String(Date.now())}-${Math.random().toString(36).slice(2)}`
    const pendingMessage = createPendingUserMessage(
      content,
      pendingMessageId,
      new Date().toISOString(),
    )

    setComposerValue('')
    setSendStatus('sending')
    setSendError(null)
    setMessages((current) => createOptimisticSendState(current, pendingMessage).messages)

    void sendAndReconcile(conversation.conversationId, content, runId, pendingMessageId, {
      setMessages,
      setSendStatus,
      setSendError,
      conversationRequestIdRef,
    })
  }

  return {
    activeAvatarId,
    conversation,
    conversationStatus,
    conversationError,
    messages,
    composerValue,
    sendStatus,
    sendError,
    canSend: conversation !== null && sendStatus !== 'sending',
    setComposerValue,
    startChatWithAvatar,
    sendCurrentMessage,
  }
}

type ConversationSetters = {
  setConversation: (value: ConversationSummary) => void
  setConversationStatus: (value: ConversationStatus) => void
  setConversationError: (value: string | null) => void
  conversationRequestIdRef: RequestRef
}

type RequestRef = {
  current: number
}

async function createConversation(
  sessionId: string,
  avatarId: string,
  requestId: number,
  setters: ConversationSetters,
): Promise<void> {
  try {
    const createdConversation = await startConversation(sessionId, { avatarId })
    if (requestId !== setters.conversationRequestIdRef.current) {
      return
    }

    setters.setConversation(createdConversation)
    setters.setConversationStatus('ready')
    setters.setConversationError(null)
  } catch (error) {
    if (requestId !== setters.conversationRequestIdRef.current) {
      return
    }

    setters.setConversationStatus('error')
    setters.setConversationError(error instanceof Error ? error.message : 'Unable to start chat')
  }
}

type SendSetters = {
  setMessages: (updater: (current: ChatThreadMessage[]) => ChatThreadMessage[]) => void
  setSendStatus: (value: SendStatus) => void
  setSendError: (value: string | null) => void
  conversationRequestIdRef: RequestRef
}

async function sendAndReconcile(
  conversationId: string,
  content: string,
  runId: number,
  pendingMessageId: string,
  setters: SendSetters,
): Promise<void> {
  try {
    const response = await sendMessage(conversationId, {
      message: { content },
    })

    if (runId !== setters.conversationRequestIdRef.current) {
      return
    }

    setters.setMessages((current) => {
      return reconcileSendSuccess(
        current,
        pendingMessageId,
        {
          localId: response.userMessage.messageId,
          role: response.userMessage.role,
          content: response.userMessage.content,
          createdAt: response.userMessage.createdAt,
        },
        {
          localId: response.avatarMessage.messageId,
          role: response.avatarMessage.role,
          content: response.avatarMessage.content,
          createdAt: response.avatarMessage.createdAt,
        },
      )
    })
    setters.setSendStatus('idle')
    setters.setSendError(null)
  } catch (error) {
    if (runId !== setters.conversationRequestIdRef.current) {
      return
    }

    setters.setMessages((current) => markSendFailure(current, pendingMessageId))
    setters.setSendStatus('idle')
    setters.setSendError(error instanceof Error ? error.message : 'Unable to send message')
  }
}

function markMessageAsFailed(message: ChatThreadMessage): ChatThreadMessage {
  return {
    localId: message.localId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    failed: true,
  }
}

type ThreadStateSetters = {
  setActiveAvatarId: (value: string | null) => void
  setConversation: (value: ConversationSummary | null) => void
  setConversationStatus: (value: ConversationStatus) => void
  setConversationError: (value: string | null) => void
  setMessages: (value: ChatThreadMessage[]) => void
  setComposerValue: (value: string) => void
  setSendStatus: (value: SendStatus) => void
  setSendError: (value: string | null) => void
}

function applyThreadState(state: ChatThreadState, setters: ThreadStateSetters): void {
  setters.setActiveAvatarId(state.activeAvatarId)
  setters.setConversation(state.conversation)
  setters.setConversationStatus(state.conversationStatus)
  setters.setConversationError(state.conversationError)
  setters.setMessages(state.messages)
  setters.setComposerValue(state.composerValue)
  setters.setSendStatus(state.sendStatus)
  setters.setSendError(state.sendError)
}

export function createThreadStateForAvatarSelection(avatarId: string): ChatThreadState {
  return {
    activeAvatarId: avatarId,
    conversation: null,
    conversationStatus: 'starting',
    conversationError: null,
    messages: [],
    composerValue: '',
    sendStatus: 'idle',
    sendError: null,
  }
}

export function createPendingUserMessage(
  content: string,
  localId: string,
  createdAt: string,
): ChatThreadMessage {
  return {
    localId,
    role: 'user',
    content,
    createdAt,
    pending: true,
  }
}

export function reconcileSendSuccess(
  messages: ChatThreadMessage[],
  pendingMessageId: string,
  userMessage: ChatThreadMessage,
  avatarMessage: ChatThreadMessage,
): ChatThreadMessage[] {
  const withUser = messages.map((message) =>
    message.localId === pendingMessageId ? userMessage : message,
  )

  return [...withUser, avatarMessage]
}

export function markSendFailure(
  messages: ChatThreadMessage[],
  pendingMessageId: string,
): ChatThreadMessage[] {
  return messages.map((message) =>
    message.localId === pendingMessageId ? markMessageAsFailed(message) : message,
  )
}

export function createOptimisticSendState(
  currentMessages: ChatThreadMessage[],
  pendingMessage: ChatThreadMessage,
): OptimisticSendState {
  return {
    composerValue: '',
    sendStatus: 'sending',
    sendError: null,
    messages: [...currentMessages, pendingMessage],
  }
}
