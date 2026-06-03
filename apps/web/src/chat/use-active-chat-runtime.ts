import { useEffect, useRef, useState } from 'react'
import type { ConversationSummary, SessionSummary } from '@gami/shared'
import i18n from '../i18n/index'
import {
  endConversation,
  getConversationHistory,
  sendMessage,
  startConversation,
} from '../api/conversations'
import {
  createOptimisticSendState,
  createPendingUserMessage,
  createThreadStateForAvatarSelection,
  createThreadStateForConversationEnd,
  markSendFailure,
  reconcileSendSuccess,
  type ChatThreadMessage,
  type ChatThreadState,
  type ConversationStatus,
  type OptimisticSendState,
  type SendStatus,
} from './chat-thread-state'

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
  canEndConversation: boolean
  setComposerValue: (value: string) => void
  startChatWithAvatar: (avatarId: string) => void
  sendCurrentMessage: () => void
  endCurrentConversation: () => void
}

export {
  createOptimisticSendState,
  createPendingUserMessage,
  createThreadStateForAvatarSelection,
  createThreadStateForConversationEnd,
  markSendFailure,
  reconcileSendSuccess,
}
export type { ChatThreadMessage, ChatThreadState, OptimisticSendState }

type ActiveChatRuntimeOptions = {
  initialActiveAvatarId?: string | null
  initialConversationId?: string | null
}

export function useActiveChatRuntime(
  session: SessionSummary | null,
  options?: ActiveChatRuntimeOptions,
): ActiveChatRuntimeState {
  const initialActiveAvatarId = options?.initialActiveAvatarId ?? null
  const initialConversationId = options?.initialConversationId ?? null
  const [activeAvatarId, setActiveAvatarId] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationSummary | null>(null)
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>('idle')
  const [conversationError, setConversationError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatThreadMessage[]>([])
  const [composerValue, setComposerValue] = useState('')
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [sendError, setSendError] = useState<string | null>(null)
  const conversationRequestIdRef = useRef(0)
  const previousSessionIdRef = useRef<string | null>(null)
  const rehydratedConversationRef = useRef(false)
  const threadSetters: ThreadStateSetters = {
    setActiveAvatarId,
    setConversation,
    setConversationStatus,
    setConversationError,
    setMessages,
    setComposerValue,
    setSendStatus,
    setSendError,
  }
  const restoreSetters: RestoreSetters = { ...threadSetters, conversationRequestIdRef }
  const endSetters: EndConversationSetters = { ...threadSetters, conversationRequestIdRef }
  useResetThreadOnSessionChange(
    session,
    previousSessionIdRef,
    rehydratedConversationRef,
    threadSetters,
  )
  useRehydrateConversationFromStorage(
    session,
    initialActiveAvatarId,
    initialConversationId,
    rehydratedConversationRef,
    conversationRequestIdRef,
    restoreSetters,
  )
  function startChatWithAvatar(avatarId: string): void {
    startChat(session, avatarId, conversationRequestIdRef, threadSetters, {
      setConversation,
      setConversationStatus,
      setConversationError,
      conversationRequestIdRef,
    })
  }
  function sendCurrentMessage(): void {
    sendMessageInActiveConversation(
      conversation,
      sendStatus,
      composerValue,
      conversationRequestIdRef,
      setComposerValue,
      setSendStatus,
      setSendError,
      setMessages,
    )
  }
  function endCurrentConversation(): void {
    endActiveConversation(
      session,
      conversation,
      sendStatus,
      conversationStatus,
      conversationRequestIdRef,
      setConversationStatus,
      setConversationError,
      endSetters,
    )
  }
  const canSend = conversation !== null && sendStatus !== 'sending'
  const canEndConversation =
    conversation !== null && conversationStatus === 'ready' && sendStatus !== 'sending'
  return {
    activeAvatarId,
    conversation,
    conversationStatus,
    conversationError,
    messages,
    composerValue,
    sendStatus,
    sendError,
    canSend,
    canEndConversation,
    setComposerValue,
    startChatWithAvatar,
    sendCurrentMessage,
    endCurrentConversation,
  }
}

function useResetThreadOnSessionChange(
  session: SessionSummary | null,
  previousSessionIdRef: { current: string | null },
  rehydratedConversationRef: { current: boolean },
  threadSetters: ThreadStateSetters,
): void {
  useEffect(() => {
    const nextSessionId = session?.sessionId ?? null
    if (previousSessionIdRef.current === nextSessionId) {
      return
    }

    previousSessionIdRef.current = nextSessionId
    rehydratedConversationRef.current = false
    applyThreadState(createThreadStateForConversationEnd(), threadSetters)
  }, [session, previousSessionIdRef, rehydratedConversationRef, threadSetters])
}

function useRehydrateConversationFromStorage(
  session: SessionSummary | null,
  initialActiveAvatarId: string | null,
  initialConversationId: string | null,
  rehydratedConversationRef: { current: boolean },
  conversationRequestIdRef: RequestRef,
  restoreSetters: RestoreSetters,
): void {
  useEffect(() => {
    if (session === null || rehydratedConversationRef.current) {
      return
    }
    if (initialConversationId === null || initialActiveAvatarId === null) {
      rehydratedConversationRef.current = true
      return
    }

    rehydratedConversationRef.current = true
    conversationRequestIdRef.current += 1
    const requestId = conversationRequestIdRef.current
    restoreSetters.setActiveAvatarId(initialActiveAvatarId)
    restoreSetters.setConversationStatus('starting')
    restoreSetters.setConversationError(null)

    void restoreConversation(initialConversationId, requestId, restoreSetters)
  }, [
    session,
    initialActiveAvatarId,
    initialConversationId,
    rehydratedConversationRef,
    conversationRequestIdRef,
    restoreSetters,
  ])
}

function startChat(
  session: SessionSummary | null,
  avatarId: string,
  conversationRequestIdRef: RequestRef,
  threadSetters: ThreadStateSetters,
  conversationSetters: ConversationSetters,
): void {
  if (session === null) {
    conversationSetters.setConversationStatus('error')
    conversationSetters.setConversationError(i18n.t('errors.sessionUnavailable'))
    return
  }

  conversationRequestIdRef.current += 1
  const requestId = conversationRequestIdRef.current
  applyThreadState(createThreadStateForAvatarSelection(avatarId), threadSetters)
  void createConversation(session.sessionId, avatarId, requestId, conversationSetters)
}

function sendMessageInActiveConversation(
  conversation: ConversationSummary | null,
  sendStatus: SendStatus,
  composerValue: string,
  conversationRequestIdRef: RequestRef,
  setComposerValue: (value: string) => void,
  setSendStatus: (value: SendStatus) => void,
  setSendError: (value: string | null) => void,
  setMessages: (updater: (current: ChatThreadMessage[]) => ChatThreadMessage[]) => void,
): void {
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

function endActiveConversation(
  session: SessionSummary | null,
  conversation: ConversationSummary | null,
  sendStatus: SendStatus,
  conversationStatus: ConversationStatus,
  conversationRequestIdRef: RequestRef,
  setConversationStatus: (value: ConversationStatus) => void,
  setConversationError: (value: string | null) => void,
  endSetters: EndConversationSetters,
): void {
  if (
    session === null ||
    conversation === null ||
    sendStatus === 'sending' ||
    conversationStatus === 'ending'
  ) {
    return
  }

  conversationRequestIdRef.current += 1
  const runId = conversationRequestIdRef.current
  setConversationStatus('ending')
  setConversationError(null)
  void endAndClearConversation(session.sessionId, conversation.conversationId, runId, endSetters)
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
    setters.setConversationError(
      error instanceof Error ? error.message : i18n.t('errors.unableToStartChat'),
    )
  }
}

type SendSetters = {
  setMessages: (updater: (current: ChatThreadMessage[]) => ChatThreadMessage[]) => void
  setSendStatus: (value: SendStatus) => void
  setSendError: (value: string | null) => void
  conversationRequestIdRef: RequestRef
}

type RestoreSetters = {
  setActiveAvatarId: (value: string | null) => void
  setConversation: (value: ConversationSummary | null) => void
  setConversationStatus: (value: ConversationStatus) => void
  setConversationError: (value: string | null) => void
  setMessages: (value: ChatThreadMessage[]) => void
  setComposerValue: (value: string) => void
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
    setters.setSendError(
      error instanceof Error ? error.message : i18n.t('errors.unableToSendMessage'),
    )
  }
}

async function restoreConversation(
  conversationId: string,
  requestId: number,
  setters: RestoreSetters,
): Promise<void> {
  try {
    const history = await getConversationHistory(conversationId)
    if (requestId !== setters.conversationRequestIdRef.current) {
      return
    }

    setters.setActiveAvatarId(history.conversation.avatarId)
    setters.setConversation(history.conversation)
    setters.setConversationStatus('ready')
    setters.setConversationError(null)
    setters.setMessages(
      history.messages.map((message) => ({
        localId: message.messageId,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    )
    setters.setComposerValue('')
    setters.setSendStatus('idle')
    setters.setSendError(null)
  } catch (error) {
    if (requestId !== setters.conversationRequestIdRef.current) {
      return
    }

    applyThreadState(createThreadStateForConversationEnd(), {
      setActiveAvatarId: setters.setActiveAvatarId,
      setConversation: setters.setConversation,
      setConversationStatus: setters.setConversationStatus,
      setConversationError: setters.setConversationError,
      setMessages: setters.setMessages,
      setComposerValue: setters.setComposerValue,
      setSendStatus: setters.setSendStatus,
      setSendError: setters.setSendError,
    })
    setters.setConversationError(
      error instanceof Error ? error.message : i18n.t('errors.unableToRestoreConversation'),
    )
  }
}

type EndConversationSetters = {
  setActiveAvatarId: (value: string | null) => void
  setConversation: (value: ConversationSummary | null) => void
  setConversationStatus: (value: ConversationStatus) => void
  setConversationError: (value: string | null) => void
  setMessages: (value: ChatThreadMessage[]) => void
  setComposerValue: (value: string) => void
  setSendStatus: (value: SendStatus) => void
  setSendError: (value: string | null) => void
  conversationRequestIdRef: RequestRef
}

async function endAndClearConversation(
  sessionId: string,
  conversationId: string,
  runId: number,
  setters: EndConversationSetters,
): Promise<void> {
  try {
    await endConversation(sessionId, conversationId)
    if (runId !== setters.conversationRequestIdRef.current) {
      return
    }

    applyThreadState(createThreadStateForConversationEnd(), setters)
  } catch (error) {
    if (runId !== setters.conversationRequestIdRef.current) {
      return
    }

    setters.setConversationStatus('ready')
    setters.setConversationError(
      error instanceof Error ? error.message : i18n.t('errors.unableToEndConversation'),
    )
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
