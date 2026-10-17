import type { ContextEngineInput, ContextEngineOutput } from './context-engine.types.js'
import type {
  ContextProjection,
  ContextSectionId,
  ContextSegmentId,
  ContextEnginePolicy,
} from './context-engine.policy.js'
import { DEFAULT_CONTEXT_ENGINE_POLICY, precedenceRank } from './context-engine.policy.js'
import {
  EMPTY_EXCHANGES,
  EMPTY_EPISODIC_MEMORIES,
  EMPTY_MESSAGES,
  EMPTY_RESPONSE_RULES,
  type CandidateSegment,
  type MutableOutput,
  normalizeInput,
  buildCandidates,
  hasText,
  normalizeResponseRules,
} from './context-engine.candidates.js'

export class ContextEngine {
  constructor(private readonly policy: ContextEnginePolicy = DEFAULT_CONTEXT_ENGINE_POLICY) {}

  assemble(input: ContextEngineInput): ContextEngineOutput {
    const normalized = normalizeInput(input)
    const draft = buildBaseOutput(input)
    const candidates = buildCandidates(input, normalized)
    const selection = applyBudgetAndSelection(draft, candidates, this.policy)

    return {
      avatar: draft.avatar,
      gm: draft.gm,
      trace: buildTrace(input, this.policy, selection),
    }
  }
}

function buildBaseOutput(input: ContextEngineInput): MutableOutput {
  return {
    avatar: {
      ...(input.activeAvatarId !== undefined ? { avatarId: input.activeAvatarId } : {}),
      sections: {
        directorNotes: null,
        responseRules: { items: EMPTY_RESPONSE_RULES },
        conversationState: {
          recentExchanges: EMPTY_EXCHANGES,
          workingMemory: {},
          episodicMemories: EMPTY_EPISODIC_MEMORIES,
        },
        userPersona: null,
        worldContext: input.scenario,
      },
    },
    gm: {
      currentState: input.gmState,
      availableAvatars: input.availableAvatars,
      sections: {
        conversationState: {
          recentMessages: EMPTY_MESSAGES,
          recentExchanges: EMPTY_EXCHANGES,
          episodicMemories: EMPTY_EPISODIC_MEMORIES,
        },
        userPersona: null,
        worldContext: input.scenario,
      },
    },
  }
}

function stableSortCandidates(
  candidates: CandidateSegment[],
  policy: ContextEnginePolicy,
): CandidateSegment[] {
  return candidates.slice().sort((a, b) => {
    const precedenceDelta =
      precedenceRank(policy, a.segmentId) - precedenceRank(policy, b.segmentId)
    if (precedenceDelta !== 0) return precedenceDelta
    if (a.projection !== b.projection) return a.projection.localeCompare(b.projection)
    if (a.segmentId !== b.segmentId) return a.segmentId.localeCompare(b.segmentId)
    return 0
  })
}

function applyBudgetAndSelection(
  draft: MutableOutput,
  candidates: CandidateSegment[],
  policy: ContextEnginePolicy,
): ContextEngineOutput['trace']['selection'] {
  const kept: ContextEngineOutput['trace']['selection']['kept'] = []
  const trimmed: ContextEngineOutput['trace']['selection']['trimmed'] = []
  const budgetUsed: Record<ContextProjection, number> = {
    avatar: 0,
    gm: 0,
  }

  for (const candidate of stableSortCandidates(candidates, policy)) {
    const isProtected = policy.protectedSegments.includes(candidate.segmentId)
    if (!isProtected && exceedsProjectionBudget(budgetUsed, candidate, policy)) {
      trimmed.push({
        projection: candidate.projection,
        sectionId: candidate.sectionId,
        segmentId: candidate.segmentId,
        tokenEstimate: candidate.tokenEstimate,
        reason: 'budget_exceeded',
      })
      continue
    }

    candidate.apply(draft)
    budgetUsed[candidate.projection] += candidate.tokenEstimate
    kept.push({
      projection: candidate.projection,
      sectionId: candidate.sectionId,
      segmentId: candidate.segmentId,
      tokenEstimate: candidate.tokenEstimate,
      reason: isProtected ? 'protected' : 'within_budget',
    })
  }

  return { kept, trimmed }
}

function exceedsProjectionBudget(
  budgetUsed: Record<ContextProjection, number>,
  candidate: CandidateSegment,
  policy: ContextEnginePolicy,
): boolean {
  const maxBudget =
    candidate.projection === 'avatar'
      ? policy.tokenBudget.avatarMaxTokens
      : policy.tokenBudget.gmMaxTokens
  return budgetUsed[candidate.projection] + candidate.tokenEstimate > maxBudget
}

function buildTrace(
  input: ContextEngineInput,
  policy: ContextEnginePolicy,
  selection: ContextEngineOutput['trace']['selection'],
): ContextEngineOutput['trace'] {
  return {
    deterministic: true,
    policy: buildTracePolicy(policy),
    selectedInputs: buildTraceSelectedInputs(input),
    rationale: {
      avatarProjection: [
        'section-driven-precedence',
        'single-pass-assembly',
        'deterministic-selection',
      ],
      gmProjection: [
        'section-driven-precedence',
        'single-pass-assembly',
        'deterministic-selection',
      ],
    },
    selection,
  }
}

function buildTracePolicy(policy: ContextEnginePolicy): ContextEngineOutput['trace']['policy'] {
  return {
    tokenBudget: {
      avatarMaxTokens: policy.tokenBudget.avatarMaxTokens,
      gmMaxTokens: policy.tokenBudget.gmMaxTokens,
    },
    sectionPrecedence: [...policy.sectionPrecedence],
    protectedSegments: [...policy.protectedSegments],
    precedence: [...policy.precedence],
  }
}

// eslint-disable-next-line complexity -- counts each optional context input for the bounded trace
function buildTraceSelectedInputs(
  input: ContextEngineInput,
): ContextEngineOutput['trace']['selectedInputs'] {
  const visibility = buildTraceVisibility(input)
  return {
    hasActiveAvatar: input.activeAvatarId !== undefined,
    recentMessageCount: input.recentMessages.length,
    shortTermExchangeCount: input.extensions.memory?.shortTerm?.recentExchanges.length ?? 0,
    episodicMemoryCount: input.extensions.memory?.episodicMemories?.length ?? 0,
    hasWorkingMemory: input.extensions.memory?.working !== undefined,
    retrievalCounts: buildTraceRetrievalCounts(input),
    ...(input.extensions.retrieval?.trace !== undefined
      ? { retrieval: input.extensions.retrieval.trace }
      : {}),
    ...(input.extensions.retrievalForGm?.trace !== undefined
      ? { gmRetrieval: input.extensions.retrievalForGm.trace }
      : {}),
    gmRetrievalCounts: buildTraceGmRetrievalCounts(input),
    ...(visibility !== undefined ? { visibility } : {}),
    hasUserPersona: input.extensions.userPersona !== null,
    hasGmDirective: hasText(input.extensions.gmDirective),
    responseRuleCount: normalizeResponseRules(input.extensions.responseRules).length,
    hasAvatarTraits: input.extensions.avatarTraits !== undefined,
  }
}

function buildTraceRetrievalCounts(
  input: ContextEngineInput,
): ContextEngineOutput['trace']['selectedInputs']['retrievalCounts'] {
  return {
    avatar_knowledge: input.extensions.retrieval?.avatar_knowledge.length ?? 0,
    world: input.extensions.retrieval?.world.length ?? 0,
    media: input.extensions.retrieval?.media.length ?? 0,
  }
}

function buildTraceGmRetrievalCounts(
  input: ContextEngineInput,
): ContextEngineOutput['trace']['selectedInputs']['gmRetrievalCounts'] {
  return {
    avatar_knowledge: input.extensions.retrievalForGm?.avatar_knowledge.length ?? 0,
    world: input.extensions.retrievalForGm?.world.length ?? 0,
    media: input.extensions.retrievalForGm?.media.length ?? 0,
  }
}

// Keep this helper explicit for trace explainability while preserving deterministic defaults.
function buildTraceVisibility(
  input: ContextEngineInput,
): ContextEngineOutput['trace']['selectedInputs']['visibility'] | undefined {
  const trace = input.extensions.retrieval?.trace
  if (trace === undefined) return undefined
  const perTypeVisibility = [
    trace.perType.avatar_knowledge.visibility,
    trace.perType.world.visibility,
    trace.perType.media.visibility,
  ]
  const activeAvatarId = firstDefinedAvatarId(perTypeVisibility) ?? input.activeAvatarId
  return {
    ...(activeAvatarId !== undefined ? { activeAvatarId } : {}),
    ...(input.extensions.retrievalForGm !== undefined
      ? {
          gmRetrievalCounts: {
            avatar_knowledge: input.extensions.retrievalForGm.avatar_knowledge.length,
            world: input.extensions.retrievalForGm.world.length,
            media: input.extensions.retrievalForGm.media.length,
          },
          gmUnrestricted: true,
        }
      : {}),
  }
}

function firstDefinedAvatarId(
  visibilities: Array<{ activeAvatarId?: string } | undefined>,
): string | undefined {
  return visibilities.map((visibility) => visibility?.activeAvatarId).find(hasText)
}

export function getContextSectionPrecedence(
  policy: ContextEnginePolicy = DEFAULT_CONTEXT_ENGINE_POLICY,
): ContextSectionId[] {
  return [...policy.sectionPrecedence]
}

export function getContextSegmentPrecedence(
  policy: ContextEnginePolicy = DEFAULT_CONTEXT_ENGINE_POLICY,
): ContextSegmentId[] {
  return [...policy.precedence]
}

export function compareSegmentPrecedence(
  a: ContextSegmentId,
  b: ContextSegmentId,
  policy: ContextEnginePolicy = DEFAULT_CONTEXT_ENGINE_POLICY,
): number {
  return precedenceRank(policy, a) - precedenceRank(policy, b)
}
