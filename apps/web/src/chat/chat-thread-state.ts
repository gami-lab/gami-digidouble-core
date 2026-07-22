import type { ConversationSummary, Message } from '@gami/shared'

export type ConversationStatus = 'idle' | 'starting' | 'ready' | 'ending' | 'error'
export type SendStatus = 'idle' | 'streaming'

export type ChatThreadMessage = {
  localId: string
  role: Message['role']
  content: string
  createdAt: string
  pending?: true
  failed?: true
}

export type ChatThreadAvatarDraft = {
  localId: string
  content: string
  createdAt: string
}

export type ChatThreadState = {
  activeAvatarId: string | null
  conversation: ConversationSummary | null
  conversationStatus: ConversationStatus
  conversationError: string | null
  messages: ChatThreadMessage[]
  avatarDraft: ChatThreadAvatarDraft | null
  composerValue: string
  sendStatus: SendStatus
  sendError: string | null
}

export type OptimisticSendState = {
  composerValue: string
  sendStatus: SendStatus
  sendError: string | null
  messages: ChatThreadMessage[]
  avatarDraft: ChatThreadAvatarDraft | null
}

export function createThreadStateForAvatarSelection(avatarId: string): ChatThreadState {
  return {
    activeAvatarId: avatarId,
    conversation: null,
    conversationStatus: 'starting',
    conversationError: null,
    messages: [],
    avatarDraft: null,
    composerValue: '',
    sendStatus: 'idle',
    sendError: null,
  }
}

export function createThreadStateForConversationEnd(): ChatThreadState {
  return {
    activeAvatarId: null,
    conversation: null,
    conversationStatus: 'idle',
    conversationError: null,
    messages: [],
    avatarDraft: null,
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
  const withoutExistingAvatar = withUser.filter(
    (message) => message.localId !== avatarMessage.localId,
  )

  return [...withoutExistingAvatar, avatarMessage]
}

export function reconcilePendingUserMessage(
  messages: ChatThreadMessage[],
  pendingMessageId: string,
  userMessage: ChatThreadMessage,
): ChatThreadMessage[] {
  return messages.map((message) => (message.localId === pendingMessageId ? userMessage : message))
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
    sendStatus: 'streaming',
    sendError: null,
    messages: [...currentMessages, pendingMessage],
    avatarDraft: null,
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
