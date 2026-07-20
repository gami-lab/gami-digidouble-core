export type ContextSectionId =
  | 'directorNotes'
  | 'responseRules'
  | 'conversationState'
  | 'userPersona'
  | 'worldContext'
  | 'retrievedContext'
  | 'avatarTraits'

export type ContextSegmentId =
  | 'directorNotes'
  | 'responseRules'
  | 'conversationStateWorkingMemory'
  | 'conversationStateLongTermFacts'
  | 'conversationStateRecentExchanges'
  | 'conversationStateRecentMessages'
  | 'userPersona'
  | 'worldContext'
  | 'retrievedContextMemory'
  | 'retrievedContextWorld'
  | 'retrievedContextMedia'
  | 'avatarTraits'

export type ContextProjection = 'avatar' | 'gm'

export type ContextEnginePolicy = {
  tokenBudget: {
    avatarMaxTokens: number
    gmMaxTokens: number
  }
  sectionPrecedence: ContextSectionId[]
  protectedSegments: ContextSegmentId[]
  precedence: ContextSegmentId[]
}

export const DEFAULT_CONTEXT_ENGINE_POLICY: ContextEnginePolicy = {
  tokenBudget: {
    avatarMaxTokens: 4096,
    gmMaxTokens: 4096,
  },
  sectionPrecedence: [
    'directorNotes',
    'responseRules',
    'conversationState',
    'userPersona',
    'worldContext',
    'retrievedContext',
    'avatarTraits',
  ],
  protectedSegments: ['directorNotes', 'responseRules', 'worldContext'],
  precedence: [
    'directorNotes',
    'responseRules',
    'conversationStateWorkingMemory',
    'conversationStateLongTermFacts',
    'conversationStateRecentExchanges',
    'conversationStateRecentMessages',
    'userPersona',
    'worldContext',
    'retrievedContextMemory',
    'retrievedContextWorld',
    'retrievedContextMedia',
    'avatarTraits',
  ],
}

const CONTEXT_SECTION_BY_SEGMENT: Record<ContextSegmentId, ContextSectionId> = {
  directorNotes: 'directorNotes',
  responseRules: 'responseRules',
  conversationStateWorkingMemory: 'conversationState',
  conversationStateLongTermFacts: 'conversationState',
  conversationStateRecentExchanges: 'conversationState',
  conversationStateRecentMessages: 'conversationState',
  userPersona: 'userPersona',
  worldContext: 'worldContext',
  retrievedContextMemory: 'retrievedContext',
  retrievedContextWorld: 'retrievedContext',
  retrievedContextMedia: 'retrievedContext',
  avatarTraits: 'avatarTraits',
}

export function toContextSectionId(segmentId: ContextSegmentId): ContextSectionId {
  return CONTEXT_SECTION_BY_SEGMENT[segmentId]
}

export function precedenceRank(policy: ContextEnginePolicy, segmentId: ContextSegmentId): number {
  const index = policy.precedence.indexOf(segmentId)
  return index >= 0 ? index : policy.precedence.length
}
