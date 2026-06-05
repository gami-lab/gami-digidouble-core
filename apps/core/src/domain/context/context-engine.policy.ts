export type ContextSegmentId =
  | 'gmDirective'
  | 'scenario'
  | 'userPersona'
  | 'shortTermMemory'
  | 'workingMemory'
  | 'longTermFacts'
  | 'typedRetrievalMemory'
  | 'typedRetrievalWorld'
  | 'typedRetrievalMedia'
  | 'recentMessages'

export type ContextProjection = 'avatar' | 'gm'

export type ContextEnginePolicy = {
  tokenBudget: {
    avatarMaxTokens: number
    gmMaxTokens: number
  }
  protectedSegments: ContextSegmentId[]
  precedence: ContextSegmentId[]
}

export const DEFAULT_CONTEXT_ENGINE_POLICY: ContextEnginePolicy = {
  tokenBudget: {
    avatarMaxTokens: 4096,
    gmMaxTokens: 4096,
  },
  protectedSegments: ['gmDirective', 'scenario'],
  precedence: [
    'gmDirective',
    'scenario',
    'userPersona',
    'shortTermMemory',
    'workingMemory',
    'longTermFacts',
    'typedRetrievalMemory',
    'typedRetrievalWorld',
    'typedRetrievalMedia',
    'recentMessages',
  ],
}

export function precedenceRank(policy: ContextEnginePolicy, segmentId: ContextSegmentId): number {
  const index = policy.precedence.indexOf(segmentId)
  return index >= 0 ? index : policy.precedence.length
}
