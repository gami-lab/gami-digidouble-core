import { useEffect, useRef, useState } from 'react'
import type { ConversationSummary, SessionSummary } from '@gami/shared'
import i18n from '../i18n/index'
import { startConversation, switchAvatar } from '../api/conversations'
import { sendMessageStream } from '../api/conversations'
import { startVoiceTurn } from './voice-turn'
import {
  startStreamedTurn,
  type AvatarDraftSetter,
  type ActiveStreamControllerRef,
} from './message-stream-runtime'
import {
  createOptimisticSendState,
  createPendingUserMessage,
  createThreadStateForAvatarSelection,
  createThreadStateForConversationEnd,
  markSendFailure,
  reconcilePendingUserMessage,
  reconcileSendSuccess,
  type ChatThreadAvatarDraft,
  type ChatThreadMessage,
  type ChatThreadState,
  type ConversationStatus,
  type OptimisticSendState,
  type SendStatus,
} from './chat-thread-state'
import { useMessageAudioPlayback, type AudioPlaybackState } from './use-message-audio-playback'
import {
  applyThreadState,
  endAndClearConversation,
  restoreConversation,
  type EndConversationSetters,
  type RequestRef,
  type RestoreSetters,
  type ThreadStateSetters,
} from './conversation-lifecycle'

export type ActiveChatRuntimeState = {
  activeAvatarId: string | null
  conversation: ConversationSummary | null
  conversationStatus: ConversationStatus
  conversationError: string | null
  messages: ChatThreadMessage[]
  avatarDraft: ChatThreadAvatarDraft | null
  composerValue: string
  sendStatus: SendStatus
  sendError: string | null
  audio: AudioPlaybackState
  canSend: boolean
  canEndConversation: boolean
  setComposerValue: (value: string) => void
  /** Opens a conversation (switching away from the current one); `firstMessage` is then sent. */
  startChatWithAvatar: (avatarId: string, firstMessage?: string) => void
  sendCurrentMessage: () => void
  /** Sends `content` through the same path as typed text, leaving the composer untouched. */
  sendMessage: (content: string) => void
  /** Sends one recorded utterance; the transcript replaces the pending bubble. */
  sendVoiceMessage: (audio: Blob, durationMs?: number) => void
  endCurrentConversation: () => void
  playMessageAudio: (messageId: string) => void
  stopMessageAudio: () => void
}

export {
  createOptimisticSendState,
  createPendingUserMessage,
  createThreadStateForAvatarSelection,
  createThreadStateForConversationEnd,
  markSendFailure,
  reconcilePendingUserMessage,
  reconcileSendSuccess,
}
export type { ChatThreadAvatarDraft, ChatThreadMessage, ChatThreadState, OptimisticSendState }

type ActiveChatRuntimeOptions = {
  initialActiveAvatarId?: string | null
  initialConversationId?: string | null
}

// eslint-disable-next-line max-lines-per-function -- hook owns the chat session state machine whose callbacks share refs
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
  const [avatarDraft, setAvatarDraft] = useState<ChatThreadAvatarDraft | null>(null)
  const [composerValue, setComposerValue] = useState('')
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [sendError, setSendError] = useState<string | null>(null)
  const messageAudio = useMessageAudioPlayback(conversation?.conversationId ?? null)
  const conversationRequestIdRef = useRef(0)
  const activeStreamControllerRef = useRef<AbortController | null>(null)
  const previousSessionIdRef = useRef<string | null>(null)
  const rehydratedConversationRef = useRef(false)
  const pendingFirstMessageRef = useRef<string | null>(null)
  const canSend = conversation !== null && sendStatus !== 'streaming'
  const threadSetters: ThreadStateSetters = {
    setActiveAvatarId,
    setConversation,
    setConversationStatus,
    setConversationError,
    setMessages,
    setAvatarDraft,
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
    conversationRequestIdRef,
    activeStreamControllerRef,
    messageAudio.stopMessageAudio,
  )
  useEffect(() => {
    return () => {
      activeStreamControllerRef.current?.abort()
    }
  }, [activeStreamControllerRef])
  useRehydrateConversationFromStorage(
    session,
    initialActiveAvatarId,
    initialConversationId,
    rehydratedConversationRef,
    conversationRequestIdRef,
    restoreSetters,
  )
  function startChatWithAvatar(avatarId: string, firstMessage?: string): void {
    if (avatarId === activeAvatarId && conversation !== null) {
      if (firstMessage !== undefined) sendText(firstMessage)
      return
    }
    messageAudio.stopMessageAudio()
    pendingFirstMessageRef.current = firstMessage?.trim() || null
    startChat(session, avatarId, conversation !== null, conversationRequestIdRef, threadSetters, {
      setConversation,
      setConversationStatus,
      setConversationError,
      conversationRequestIdRef,
      activeStreamControllerRef,
      stopMessageAudio: messageAudio.stopMessageAudio,
    })
  }
  function sendText(content: string): void {
    sendMessageInActiveConversation(
      conversation,
      sendStatus,
      content,
      conversationRequestIdRef,
      setSendStatus,
      setSendError,
      setMessages,
      setAvatarDraft,
      activeStreamControllerRef,
      messageAudio.stopMessageAudio,
      messageAudio.playMessageAudio,
    )
  }
  function sendCurrentMessage(): void {
    if (!canSend || composerValue.trim().length === 0) return
    setComposerValue('')
    sendText(composerValue)
  }
  usePendingFirstMessage(conversation, conversationStatus, pendingFirstMessageRef, sendText)
  function sendVoiceMessage(audio: Blob, durationMs?: number): void {
    if (conversation === null || sendStatus === 'streaming') return
    const recording = durationMs === undefined ? { audio } : { audio, durationMs }
    startVoiceTurn(conversation.conversationId, recording, conversationRequestIdRef.current, {
      setMessages,
      setAvatarDraft,
      setSendStatus,
      setSendError,
      conversationRequestIdRef,
      activeStreamControllerRef,
      stopMessageAudio: messageAudio.stopMessageAudio,
      onAvatarMessageCompleted: messageAudio.playMessageAudio,
    })
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
      messageAudio.stopMessageAudio,
    )
  }
  const canEndConversation =
    conversation !== null && conversationStatus === 'ready' && sendStatus !== 'streaming'
  return {
    activeAvatarId,
    conversation,
    conversationStatus,
    conversationError,
    messages,
    avatarDraft,
    composerValue,
    sendStatus,
    sendError,
    audio: messageAudio.audio,
    canSend,
    canEndConversation,
    setComposerValue,
    startChatWithAvatar,
    sendCurrentMessage,
    sendMessage: sendText,
    sendVoiceMessage,
    endCurrentConversation,
    playMessageAudio: messageAudio.playMessageAudio,
    stopMessageAudio: messageAudio.stopMessageAudio,
  }
}

/** Sends a starter question through the normal send path once its conversation is ready. */
function usePendingFirstMessage(
  conversation: ConversationSummary | null,
  conversationStatus: ConversationStatus,
  pendingRef: { current: string | null },
  send: (content: string) => void,
): void {
  const readyConversationId =
    conversationStatus === 'ready' ? (conversation?.conversationId ?? null) : null
  const sendRef = useRef(send)
  sendRef.current = send
  useEffect(() => {
    const firstMessage = pendingRef.current
    if (readyConversationId === null || firstMessage === null) return
    pendingRef.current = null
    sendRef.current(firstMessage)
  }, [readyConversationId, pendingRef])
}

function useResetThreadOnSessionChange(
  session: SessionSummary | null,
  previousSessionIdRef: { current: string | null },
  rehydratedConversationRef: { current: boolean },
  threadSetters: ThreadStateSetters,
  conversationRequestIdRef: RequestRef,
  activeStreamControllerRef: ActiveStreamControllerRef,
  stopMessageAudio: () => void,
): void {
  useEffect(() => {
    const nextSessionId = session?.sessionId ?? null
    if (previousSessionIdRef.current === nextSessionId) {
      return
    }

    previousSessionIdRef.current = nextSessionId
    rehydratedConversationRef.current = false
    conversationRequestIdRef.current += 1
    activeStreamControllerRef.current?.abort()
    activeStreamControllerRef.current = null
    stopMessageAudio()
    applyThreadState(createThreadStateForConversationEnd(), threadSetters)
  }, [
    session,
    previousSessionIdRef,
    rehydratedConversationRef,
    threadSetters,
    conversationRequestIdRef,
    activeStreamControllerRef,
    stopMessageAudio,
  ])
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
  switchFromCurrent: boolean,
  conversationRequestIdRef: RequestRef,
  threadSetters: ThreadStateSetters,
  conversationSetters: ConversationSetters,
): void {
  if (session === null) {
    conversationSetters.setConversationStatus('error')
    conversationSetters.setConversationError(i18n.t('errors.sessionUnavailable'))
    return
  }

  conversationSetters.activeStreamControllerRef.current?.abort()
  conversationSetters.activeStreamControllerRef.current = null
  conversationSetters.stopMessageAudio()
  conversationRequestIdRef.current += 1
  const requestId = conversationRequestIdRef.current
  applyThreadState(createThreadStateForAvatarSelection(avatarId), threadSetters)
  void createConversation(
    session.sessionId,
    avatarId,
    switchFromCurrent,
    requestId,
    conversationSetters,
  )
}

function sendMessageInActiveConversation(
  conversation: ConversationSummary | null,
  sendStatus: SendStatus,
  text: string,
  conversationRequestIdRef: RequestRef,
  setSendStatus: (value: SendStatus) => void,
  setSendError: (value: string | null) => void,
  setMessages: (updater: (current: ChatThreadMessage[]) => ChatThreadMessage[]) => void,
  setAvatarDraft: AvatarDraftSetter,
  activeStreamControllerRef: ActiveStreamControllerRef,
  stopMessageAudio: () => void,
  onAvatarMessageCompleted: (messageId: string) => void,
): void {
  if (conversation === null || sendStatus === 'streaming') {
    return
  }

  const content = text.trim()
  if (content.length === 0) {
    return
  }

  const conversationId = conversation.conversationId
  startStreamedTurn({
    conversationId,
    pendingContent: content,
    send: (onEvent, signal) =>
      sendMessageStream(conversationId, { message: { content } }, { onEvent }, signal),
    runId: conversationRequestIdRef.current,
    setters: {
      setMessages,
      setAvatarDraft,
      setSendStatus,
      setSendError,
      conversationRequestIdRef,
      activeStreamControllerRef,
      stopMessageAudio,
      onAvatarMessageCompleted,
    },
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
  stopMessageAudio: () => void,
): void {
  if (
    session === null ||
    conversation === null ||
    sendStatus === 'streaming' ||
    conversationStatus === 'ending'
  ) {
    return
  }

  conversationRequestIdRef.current += 1
  stopMessageAudio()
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
  activeStreamControllerRef: ActiveStreamControllerRef
  stopMessageAudio: () => void
}

async function createConversation(
  sessionId: string,
  avatarId: string,
  switchFromCurrent: boolean,
  requestId: number,
  setters: ConversationSetters,
): Promise<void> {
  try {
    const createdConversation = switchFromCurrent
      ? await switchAvatar(sessionId, { avatarId })
      : await startConversation(sessionId, { avatarId })
    if (requestId !== setters.conversationRequestIdRef.current) {
      return
    }

    setters.setConversation(createdConversation)
    setters.setConversationStatus('ready')
    setters.setConversationError(null)
  } catch {
    if (requestId !== setters.conversationRequestIdRef.current) {
      return
    }

    setters.setConversationStatus('error')
    setters.setConversationError(i18n.t('errors.unableToStartChat'))
  }
}
