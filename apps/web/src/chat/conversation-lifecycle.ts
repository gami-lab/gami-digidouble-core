import type { ConversationSummary } from '@gami/shared'
import i18n from '../i18n/index'
import { endConversation, getConversationHistory } from '../api/conversations'
import {
  createThreadStateForConversationEnd,
  type ChatThreadAvatarDraft,
  type ChatThreadMessage,
  type ChatThreadState,
  type ConversationStatus,
  type SendStatus,
} from './chat-thread-state'

export type RequestRef = {
  current: number
}

export type RestoreSetters = {
  setActiveAvatarId: (value: string | null) => void
  setConversation: (value: ConversationSummary | null) => void
  setConversationStatus: (value: ConversationStatus) => void
  setConversationError: (value: string | null) => void
  setMessages: (value: ChatThreadMessage[]) => void
  setAvatarDraft: (value: ChatThreadAvatarDraft | null) => void
  setComposerValue: (value: string) => void
  setSendStatus: (value: SendStatus) => void
  setSendError: (value: string | null) => void
  conversationRequestIdRef: RequestRef
}

export async function restoreConversation(
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
    setters.setAvatarDraft(null)
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
      setAvatarDraft: setters.setAvatarDraft,
      setComposerValue: setters.setComposerValue,
      setSendStatus: setters.setSendStatus,
      setSendError: setters.setSendError,
    })
    setters.setConversationError(
      error instanceof Error ? error.message : i18n.t('errors.unableToRestoreConversation'),
    )
  }
}

export type EndConversationSetters = {
  setActiveAvatarId: (value: string | null) => void
  setConversation: (value: ConversationSummary | null) => void
  setConversationStatus: (value: ConversationStatus) => void
  setConversationError: (value: string | null) => void
  setMessages: (value: ChatThreadMessage[]) => void
  setAvatarDraft: (value: ChatThreadAvatarDraft | null) => void
  setComposerValue: (value: string) => void
  setSendStatus: (value: SendStatus) => void
  setSendError: (value: string | null) => void
  conversationRequestIdRef: RequestRef
}

export async function endAndClearConversation(
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

export type ThreadStateSetters = {
  setActiveAvatarId: (value: string | null) => void
  setConversation: (value: ConversationSummary | null) => void
  setConversationStatus: (value: ConversationStatus) => void
  setConversationError: (value: string | null) => void
  setMessages: (value: ChatThreadMessage[]) => void
  setAvatarDraft: (value: ChatThreadAvatarDraft | null) => void
  setComposerValue: (value: string) => void
  setSendStatus: (value: SendStatus) => void
  setSendError: (value: string | null) => void
}

export function applyThreadState(state: ChatThreadState, setters: ThreadStateSetters): void {
  setters.setActiveAvatarId(state.activeAvatarId)
  setters.setConversation(state.conversation)
  setters.setConversationStatus(state.conversationStatus)
  setters.setConversationError(state.conversationError)
  setters.setMessages(state.messages)
  setters.setAvatarDraft(state.avatarDraft)
  setters.setComposerValue(state.composerValue)
  setters.setSendStatus(state.sendStatus)
  setters.setSendError(state.sendError)
}
