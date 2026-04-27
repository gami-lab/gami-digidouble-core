import type { AvailableAvatarSummary, ConversationSummary, Message, SessionSummary } from '../api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvatarAvailabilityStatus = 'available' | 'active' | 'locked'

export type AvatarAvailabilityEntry = {
  avatar: AvailableAvatarSummary
  status: AvatarAvailabilityStatus
}

export type UnlockEvent = {
  avatarId: string
  avatarName: string
  reason: string
  turnIndex: number
}

export type ScenarioTestState = {
  session: SessionSummary | null
  availableAvatarIds: string[]
  allScenarioAvatars: AvailableAvatarSummary[]
  conversations: ConversationSummary[]
  selectedConversationId: string | null
  messagesByConversationId: Record<string, Message[]>
  unlockEvents: UnlockEvent[]
  lastError: string | null
}

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

export function createInitialScenarioTestState(): ScenarioTestState {
  return {
    session: null,
    availableAvatarIds: [],
    allScenarioAvatars: [],
    conversations: [],
    selectedConversationId: null,
    messagesByConversationId: {},
    unlockEvents: [],
    lastError: null,
  }
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

export function deriveAvatarAvailabilityEntries(
  state: ScenarioTestState,
): AvatarAvailabilityEntry[] {
  const activeAvatarId = state.session?.activeAvatarId ?? null

  return state.allScenarioAvatars.map((avatar) => {
    let status: AvatarAvailabilityStatus

    if (avatar.avatarId === activeAvatarId) {
      status = 'active'
    } else if (state.availableAvatarIds.includes(avatar.avatarId)) {
      status = 'available'
    } else {
      status = 'locked'
    }

    return { avatar, status }
  })
}

export function deriveConversationTimeline(
  state: ScenarioTestState,
  allAvatarsById: Map<string, AvailableAvatarSummary>,
): Array<{ conversation: ConversationSummary; avatarName: string; episodeIndex: number }> {
  const sorted = [...state.conversations].sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  const avatarEpisodeCount = new Map<string, number>()

  return sorted.map((conversation) => {
    const avatarName = allAvatarsById.get(conversation.avatarId)?.name ?? 'Unknown'
    const count = (avatarEpisodeCount.get(conversation.avatarId) ?? 0) + 1
    avatarEpisodeCount.set(conversation.avatarId, count)
    return { conversation, avatarName, episodeIndex: count }
  })
}

// ---------------------------------------------------------------------------
// State reducers
// ---------------------------------------------------------------------------

export function withSessionStarted(
  state: ScenarioTestState,
  session: SessionSummary,
  availableAvatarIds: string[],
): ScenarioTestState {
  return {
    ...state,
    session,
    availableAvatarIds,
    conversations: [],
    selectedConversationId: null,
    messagesByConversationId: {},
    unlockEvents: [],
    lastError: null,
  }
}

export function withAvailableAvatarsRefreshed(
  state: ScenarioTestState,
  availableAvatarIds: string[],
  session: SessionSummary,
  previousAvailableAvatarIds: string[],
  turnIndex: number,
  allAvatarsById: Map<string, AvailableAvatarSummary>,
): ScenarioTestState {
  const newlyUnlocked = availableAvatarIds.filter((id) => !previousAvailableAvatarIds.includes(id))
  const unlockEvents: UnlockEvent[] = [
    ...state.unlockEvents,
    ...newlyUnlocked.map((avatarId) => ({
      avatarId,
      avatarName: allAvatarsById.get(avatarId)?.name ?? avatarId,
      reason: 'Unlocked based on topic detected in last message.',
      turnIndex,
    })),
  ]

  return {
    ...state,
    session,
    availableAvatarIds,
    unlockEvents,
  }
}

export function withAllScenarioAvatars(
  state: ScenarioTestState,
  avatars: AvailableAvatarSummary[],
): ScenarioTestState {
  return { ...state, allScenarioAvatars: avatars }
}

export function withConversationAdded(
  state: ScenarioTestState,
  conversation: ConversationSummary,
  session: SessionSummary,
  select: boolean,
): ScenarioTestState {
  const exists = state.conversations.some((c) => c.conversationId === conversation.conversationId)
  const conversations = exists
    ? state.conversations.map((c) =>
        c.conversationId === conversation.conversationId ? conversation : c,
      )
    : [...state.conversations, conversation]

  return {
    ...state,
    session,
    conversations,
    selectedConversationId: select ? conversation.conversationId : state.selectedConversationId,
  }
}

export function withConversationHistoryLoaded(
  state: ScenarioTestState,
  conversationId: string,
  messages: Message[],
  conversation: ConversationSummary,
): ScenarioTestState {
  const exists = state.conversations.some((c) => c.conversationId === conversationId)
  const conversations = exists
    ? state.conversations.map((c) => (c.conversationId === conversationId ? conversation : c))
    : [...state.conversations, conversation]

  return {
    ...state,
    conversations,
    selectedConversationId: conversationId,
    messagesByConversationId: {
      ...state.messagesByConversationId,
      [conversationId]: messages,
    },
  }
}

export function withMessageExchangeAppended(
  state: ScenarioTestState,
  conversationId: string,
  conversation: ConversationSummary,
  userMessage: Message,
  avatarMessage: Message,
  session: SessionSummary,
): ScenarioTestState {
  const currentMessages = state.messagesByConversationId[conversationId] ?? []
  const exists = state.conversations.some((c) => c.conversationId === conversationId)
  const conversations = exists
    ? state.conversations.map((c) => (c.conversationId === conversationId ? conversation : c))
    : [...state.conversations, conversation]

  return {
    ...state,
    session,
    conversations,
    messagesByConversationId: {
      ...state.messagesByConversationId,
      [conversationId]: [...currentMessages, userMessage, avatarMessage],
    },
  }
}

export function withError(state: ScenarioTestState, error: string): ScenarioTestState {
  return { ...state, lastError: error }
}

export function withErrorCleared(state: ScenarioTestState): ScenarioTestState {
  return { ...state, lastError: null }
}
