import type { MessageStreamEvent } from '@gami/shared'
import i18n from '../i18n/index'
import { sendMessageStream } from '../api/conversations'
import {
  markSendFailure,
  reconcilePendingUserMessage,
  reconcileSendSuccess,
  type ChatThreadAvatarDraft,
  type ChatThreadMessage,
  type SendStatus,
} from './chat-thread-state'

export type ActiveStreamControllerRef = {
  current: AbortController | null
}

type RequestRef = {
  current: number
}

export type AvatarDraftSetter = (
  value:
    | ChatThreadAvatarDraft
    | null
    | ((current: ChatThreadAvatarDraft | null) => ChatThreadAvatarDraft | null),
) => void

type StreamMessageSetters = {
  setMessages: (updater: (current: ChatThreadMessage[]) => ChatThreadMessage[]) => void
  setAvatarDraft: AvatarDraftSetter
  setSendStatus: (value: SendStatus) => void
  setSendError: (value: string | null) => void
  conversationRequestIdRef: RequestRef
  activeStreamControllerRef: ActiveStreamControllerRef
  streamController: AbortController
}

export async function streamMessageAndReconcile(
  conversationId: string,
  content: string,
  runId: number,
  pendingMessageId: string,
  setters: StreamMessageSetters,
): Promise<void> {
  let lastSequence = -1
  let terminalEventSeen = false

  try {
    await sendMessageStream(
      conversationId,
      { message: { content } },
      {
        onEvent: (event) => {
          if (
            runId !== setters.conversationRequestIdRef.current ||
            event.conversationId !== conversationId ||
            terminalEventSeen
          ) {
            return
          }

          handleMessageStreamEvent(event, pendingMessageId, lastSequence, setters)

          if (event.type === 'conversation.message.delta') {
            lastSequence = Math.max(lastSequence, event.sequence)
          }
          if (isTerminalEvent(event)) {
            terminalEventSeen = true
          }
        },
      },
      setters.streamController.signal,
    )
  } catch (error) {
    if (runId !== setters.conversationRequestIdRef.current) {
      return
    }

    setters.setAvatarDraft(null)
    setters.setMessages((current) => markSendFailure(current, pendingMessageId))
    setters.setSendStatus('idle')
    setters.setSendError(
      error instanceof Error ? error.message : i18n.t('errors.unableToSendMessage'),
    )
  } finally {
    if (setters.activeStreamControllerRef.current === setters.streamController) {
      setters.activeStreamControllerRef.current = null
    }
  }
}

function handleMessageStreamEvent(
  event: MessageStreamEvent,
  pendingMessageId: string,
  lastSequence: number,
  setters: StreamMessageSetters,
): void {
  switch (event.type) {
    case 'conversation.message.started':
      setters.setMessages((current) =>
        reconcilePendingUserMessage(current, pendingMessageId, {
          localId: event.userMessage.messageId,
          role: event.userMessage.role,
          content: event.userMessage.content,
          createdAt: event.userMessage.createdAt,
        }),
      )
      setters.setAvatarDraft({
        localId: `draft-${event.requestId}`,
        content: '',
        createdAt: new Date().toISOString(),
      })
      return
    case 'conversation.message.delta':
      if (event.sequence <= lastSequence) {
        return
      }
      setters.setAvatarDraft((current) => {
        const draft =
          current ??
          ({
            localId: `draft-${event.requestId}`,
            content: '',
            createdAt: new Date().toISOString(),
          } satisfies ChatThreadAvatarDraft)
        return { ...draft, content: `${draft.content}${event.delta}` }
      })
      return
    case 'conversation.message.completed':
      setters.setMessages((current) =>
        reconcileSendSuccess(
          current,
          pendingMessageId,
          toThreadMessage(event.response.userMessage),
          toThreadMessage(event.response.avatarMessage),
        ),
      )
      setters.setAvatarDraft(null)
      setters.setSendStatus('idle')
      setters.setSendError(null)
      return
    case 'conversation.message.interrupted':
      setters.setAvatarDraft(null)
      setters.setSendStatus('idle')
      setters.setSendError(i18n.t('errors.messageStreamInterrupted'))
      return
    case 'conversation.message.error':
      setters.setAvatarDraft(null)
      setters.setSendStatus('idle')
      setters.setSendError(event.message)
      return
  }
}

function toThreadMessage(message: {
  messageId: string
  role: ChatThreadMessage['role']
  content: string
  createdAt: string
}): ChatThreadMessage {
  return {
    localId: message.messageId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  }
}

function isTerminalEvent(event: MessageStreamEvent): boolean {
  return (
    event.type === 'conversation.message.completed' ||
    event.type === 'conversation.message.interrupted' ||
    event.type === 'conversation.message.error'
  )
}
