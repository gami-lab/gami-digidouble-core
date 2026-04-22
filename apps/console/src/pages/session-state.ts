import type { ConversationSummary, Message, SessionSummary } from '../api'

export type SessionConsoleState = {
  session: SessionSummary | null
  conversations: ConversationSummary[]
  selectedConversationId: string | null
  messagesByConversationId: Record<string, Message[]>
}

export function createInitialSessionConsoleState(): SessionConsoleState {
  return {
    session: null,
    conversations: [],
    selectedConversationId: null,
    messagesByConversationId: {},
  }
}

export function withSession(
  state: SessionConsoleState,
  session: SessionSummary,
): SessionConsoleState {
  return {
    ...state,
    session,
  }
}

export function replaceSessionConversations(
  state: SessionConsoleState,
  conversations: ConversationSummary[],
): SessionConsoleState {
  return {
    ...state,
    conversations: sortByLastActivityDesc(uniqueByConversationId(conversations)),
  }
}

export function addOrUpdateConversation(
  state: SessionConsoleState,
  conversation: ConversationSummary,
  selectConversation: boolean,
): SessionConsoleState {
  const nextConversations = uniqueByConversationId([conversation, ...state.conversations])
  return {
    ...state,
    conversations: sortByLastActivityDesc(nextConversations),
    selectedConversationId: selectConversation
      ? conversation.conversationId
      : state.selectedConversationId,
  }
}

export function selectConversation(
  state: SessionConsoleState,
  conversationId: string,
): SessionConsoleState {
  return {
    ...state,
    selectedConversationId: conversationId,
  }
}

export function setConversationHistory(
  state: SessionConsoleState,
  conversationId: string,
  messages: Message[],
): SessionConsoleState {
  return {
    ...state,
    messagesByConversationId: {
      ...state.messagesByConversationId,
      [conversationId]: messages,
    },
  }
}

export function appendConversationExchange(
  state: SessionConsoleState,
  conversation: ConversationSummary,
  userMessage: Message,
  avatarMessage: Message,
  session: SessionSummary,
): SessionConsoleState {
  const currentMessages = state.messagesByConversationId[conversation.conversationId] ?? []
  return {
    ...addOrUpdateConversation(state, conversation, true),
    session,
    messagesByConversationId: {
      ...state.messagesByConversationId,
      [conversation.conversationId]: [...currentMessages, userMessage, avatarMessage],
    },
  }
}

export function countAvatarConversations(
  conversations: ConversationSummary[],
  avatarId: string,
): number {
  return conversations.filter((conversation) => conversation.avatarId === avatarId).length
}

function uniqueByConversationId(conversations: ConversationSummary[]): ConversationSummary[] {
  const byId = new Map<string, ConversationSummary>()

  for (const conversation of conversations) {
    byId.set(conversation.conversationId, conversation)
  }

  return [...byId.values()]
}

function sortByLastActivityDesc(conversations: ConversationSummary[]): ConversationSummary[] {
  return [...conversations].sort((left, right) =>
    right.lastActivityAt.localeCompare(left.lastActivityAt),
  )
}
