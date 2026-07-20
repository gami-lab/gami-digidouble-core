import type {
  GmSessionEventPayload,
  SessionEventRecord,
  TurnCompletedEventPayload,
} from '@gami/shared'
import type { RuntimeInspectorViewModel } from '../api'

export type GmImpactTraceEntry = {
  correlationId: string
  turnIndex: number | null
  interactionCount: number
  timelinePosition: string
  triggerContext: string
  gmRun: string[]
  gmInput: string[]
  gmRetrieval: RetrievalTraceItem[]
  gmOutput: string[]
  avatarInput: string[]
  avatarRetrieval: RetrievalTraceItem[]
  userVisibleOutcome: string[]
  errors: string[]
  createdAt: string
  status: 'applied' | 'error' | 'pending'
}

export type RetrievalTraceItem = {
  knowledgeType: 'memory' | 'world' | 'media'
  sourceName: string
  chunkId: string
  access: string
  score?: number
  matchBasis: string
}

export function buildGmImpactTrace(snapshot: RuntimeInspectorViewModel): GmImpactTraceEntry[] {
  const eventsByCorrelation = new Map<string, SessionEventRecord[]>()
  const avatarNameById = buildAvatarNameById(snapshot)
  const knowledgeSourceNameById = new Map(
    snapshot.knowledge.sources.map((source) => [source.sourceId, source.name] as const),
  )

  for (const event of snapshot.recentEvents) {
    const existing = eventsByCorrelation.get(event.correlationId) ?? []
    existing.push(event)
    eventsByCorrelation.set(event.correlationId, existing)
  }

  const traces = Array.from(eventsByCorrelation.entries())
    .map(([correlationId, events]) =>
      toTraceEntry(
        correlationId,
        events,
        snapshot.gm.transitionHistory.length,
        avatarNameById,
        knowledgeSourceNameById,
      ),
    )
    .filter((entry): entry is GmImpactTraceEntry => entry !== null)

  return traces.sort((a, b) => {
    const left = a.interactionCount
    const right = b.interactionCount
    if (right !== left) return right - left
    const leftTurn = a.turnIndex ?? -1
    const rightTurn = b.turnIndex ?? -1
    if (rightTurn !== leftTurn) return rightTurn - leftTurn
    const leftCreatedAt = Date.parse(a.createdAt)
    const rightCreatedAt = Date.parse(b.createdAt)
    if (!Number.isNaN(rightCreatedAt) && !Number.isNaN(leftCreatedAt)) {
      return rightCreatedAt - leftCreatedAt
    }
    return right - left
  })
}

// eslint-disable-next-line complexity, max-lines-per-function
function toTraceEntry(
  correlationId: string,
  events: SessionEventRecord[],
  timelineCount: number,
  avatarNameById: Map<string, string>,
  knowledgeSourceNameById: Map<string, string>,
): GmImpactTraceEntry | null {
  const gmEvent = events.find((event) => event.type === 'gm_triggered' || event.type === 'gm_error')
  if (!gmEvent) return null

  const turnEvent = events.find((event) => event.type === 'turn_completed')
  if (!isGmPayload(gmEvent.payload)) return null
  const gmPayload = gmEvent.payload
  const turnPayload = turnEvent && isTurnPayload(turnEvent.payload) ? turnEvent.payload : undefined

  const turnIndex = gmPayload.turnIndex
  const timelinePosition =
    timelineCount > 0
      ? `${String(Math.min(turnIndex, timelineCount))}/${String(timelineCount)}`
      : '-'

  const decision = gmPayload.decision
  const gmRun: string[] = []
  const gmInput: string[] = []
  const gmOutput: string[] = []
  const avatarInput: string[] = []
  const userVisibleOutcome: string[] = []
  const errors: string[] = []
  let gmRetrieval: RetrievalTraceItem[] = []
  let avatarRetrieval: RetrievalTraceItem[] = []

  gmRun.push(
    `GM ran after turn ${String(gmPayload.turnIndex)} because ${formatTriggerReason(gmPayload.triggerReason)}.`,
  )
  gmRun.push(describeStateBefore(gmPayload, avatarNameById))

  if (decision) {
    gmRun.push(describeDecision(decision, gmPayload, avatarNameById))
    if (gmPayload.gmContext) {
      const gmContextDetails = describeRecordedGmContext(
        gmPayload.gmContext,
        avatarNameById,
        knowledgeSourceNameById,
      )
      gmInput.push(...gmContextDetails.summary)
      gmRetrieval = gmContextDetails.retrieval
    }

    if (decision.suggestedAvatarId) {
      gmOutput.push(
        `GM recommendation: ${formatAvatar(decision.suggestedAvatarId, avatarNameById)}${decision.suggestedAvatarReason ? ` — ${decision.suggestedAvatarReason}` : ''}`,
      )
    }

    if (decision.switchedAvatarId) {
      gmOutput.push(
        `Next active avatar: ${formatAvatar(decision.switchedAvatarId, avatarNameById)}.`,
      )
    }

    if (decision.unlockEvaluations && decision.unlockEvaluations.length > 0) {
      gmOutput.push(
        `Avatar unlocks: ${decision.unlockEvaluations
          .map((unlock) => {
            const detail = `${unlock.avatarId} (${unlock.avatarName})`
            const reason = unlock.reason ? ` — ${unlock.reason}` : ''
            return `${detail} [${unlock.outcome}]${reason}`
          })
          .join(', ')}`,
      )
    } else if (decision.unlockedAvatarIds && decision.unlockedAvatarIds.length > 0) {
      gmOutput.push(`Avatar unlocks: ${decision.unlockedAvatarIds.join(', ')}`)
    }

    if (decision.injectedNote) {
      gmOutput.push(`GM note added to the next avatar turn: ${decision.injectedNote}`)
    } else if (decision.notesInjected) {
      gmOutput.push('GM note added to the next avatar turn.')
    }

    if (decision.directiveCount > 0) {
      gmOutput.push(
        `GM produced ${String(decision.directiveCount)} structured recommendation${decision.directiveCount === 1 ? '' : 's'}.`,
      )
    }
  } else {
    gmRun.push('Decision: no decision payload')
  }

  if (turnPayload) {
    userVisibleOutcome.push(
      `Immediate user-facing result: turn ${String(turnPayload.turnIndex)} was still answered by ${formatAvatar(turnPayload.avatarId, avatarNameById)}. GM changes apply on the next turn.`,
    )
    if (turnPayload.avatarContext) {
      const avatarContextDetails = describeRecordedAvatarContext(
        turnPayload.avatarContext,
        avatarNameById,
        knowledgeSourceNameById,
      )
      avatarInput.push(...avatarContextDetails.summary)
      avatarRetrieval = avatarContextDetails.retrieval
    }
    if (turnPayload.contextSelection) {
      avatarInput.push(formatAvatarContext(turnPayload))
      const retrievalAssembly = formatAvatarRetrievalAssembly(turnPayload)
      if (retrievalAssembly) avatarInput.push(retrievalAssembly)
    }
  } else {
    userVisibleOutcome.push('Turn completion not observed in snapshot window.')
  }

  if (gmEvent.type === 'gm_error') {
    errors.push(`GM error: ${gmPayload.errorCode ?? 'unknown'}`)
  }

  return {
    correlationId,
    turnIndex,
    interactionCount: gmPayload.interactionCount,
    timelinePosition,
    triggerContext: gmPayload.triggerReason ?? 'none',
    gmRun,
    gmInput,
    gmRetrieval,
    gmOutput,
    avatarInput,
    avatarRetrieval,
    userVisibleOutcome,
    errors,
    createdAt: gmEvent.createdAt,
    status: gmEvent.type === 'gm_error' ? 'error' : turnEvent ? 'applied' : 'pending',
  }
}

function buildAvatarNameById(snapshot: RuntimeInspectorViewModel): Map<string, string> {
  const avatarNameById = new Map<string, string>()

  for (const event of snapshot.recentEvents) {
    if (event.type !== 'gm_triggered') continue
    if (!isGmPayload(event.payload)) continue
    const availableAvatars = event.payload.gmContext?.availableAvatars ?? []
    for (const avatar of availableAvatars) {
      avatarNameById.set(avatar.avatarId, avatar.name)
    }
    const unlockEvaluations = event.payload.decision?.unlockEvaluations ?? []
    for (const unlock of unlockEvaluations) {
      avatarNameById.set(unlock.avatarId, unlock.avatarName)
    }
  }

  return avatarNameById
}

function describeStateBefore(
  payload: GmSessionEventPayload,
  avatarNameById: Map<string, string>,
): string {
  const currentAvatar = payload.stateBefore.currentAvatarId
  const avatarText =
    currentAvatar === undefined
      ? 'no active avatar was recorded'
      : `the active avatar was ${formatAvatar(currentAvatar, avatarNameById)}`
  const progression =
    payload.stateBefore.progression.length > 0
      ? `progression was "${payload.stateBefore.progression}"`
      : 'no progression label was recorded'

  return `Before the decision, ${avatarText} and ${progression}.`
}

function describeDecision(
  decision: NonNullable<GmSessionEventPayload['decision']>,
  payload: GmSessionEventPayload,
  avatarNameById: Map<string, string>,
): string {
  const targetAvatar = formatAvatar(decision.avatarId, avatarNameById)
  const sameAvatar = payload.stateBefore.currentAvatarId === decision.avatarId

  if (decision.conversationMode === 'continue') {
    return sameAvatar
      ? `GM kept ${targetAvatar} as the active avatar.`
      : `GM chose to continue with ${targetAvatar}.`
  }

  return sameAvatar
    ? `GM asked for a fresh conversation with ${targetAvatar}, even though it is the same avatar as the current turn.`
    : `GM asked to start a new conversation with ${targetAvatar}.`
}

function formatAvatar(avatarId: string, avatarNameById: Map<string, string>): string {
  const avatarName = avatarNameById.get(avatarId)
  return avatarName ? `${avatarName} (${avatarId})` : avatarId
}

function formatTriggerReason(triggerReason: string | null): string {
  if (triggerReason === null) return 'no trigger reason was recorded'
  return triggerReason.replaceAll('_', ' ')
}

type TurnContextSelectionSummary = NonNullable<TurnCompletedEventPayload['contextSelection']> & {
  responseRuleCount?: number
  hasAvatarTraits?: boolean
}

function formatCountSummary(count: number, label: string): string {
  return `${String(count)} ${label}${count === 1 ? '' : 's'}`
}

function sumTypedCounts(counts: { memory: number; world: number; media: number }): number {
  return counts.memory + counts.world + counts.media
}

function formatRetrievalCounts(includedCounts: {
  memory: number
  world: number
  media: number
}): string {
  const retrievalTotal = sumTypedCounts(includedCounts)
  return `${formatCountSummary(retrievalTotal, 'retrieved reference')} included (${String(includedCounts.memory)} memory / ${String(includedCounts.world)} world / ${String(includedCounts.media)} media)`
}

function formatAvatarContext(turnPayload: TurnCompletedEventPayload): string {
  const selected = turnPayload.contextSelection as TurnContextSelectionSummary | null | undefined
  if (!selected) return 'Avatar context used for this reply: unavailable.'

  const includedCounts = selected.retrieval?.includedCounts ?? { memory: 0, world: 0, media: 0 }
  const responseRuleCount = selected.responseRuleCount ?? 0
  const hasAvatarTraits = selected.hasAvatarTraits ?? false

  return [
    `Avatar context used for this reply: ${formatCountSummary(selected.shortTermExchangeCount, 'recent exchange')}`,
    selected.hasWorkingMemory ? 'working memory included' : 'no working memory',
    formatCountSummary(selected.longTermFactCount, 'long-term fact'),
    formatRetrievalCounts(includedCounts),
    `${formatCountSummary(responseRuleCount, 'response rule')} applied`,
    hasAvatarTraits ? 'avatar traits included' : 'no selected avatar traits',
    selected.hasGmDirective ? 'GM note included' : 'no GM note',
    selected.hasUserPersona ? 'user persona included' : 'no user persona',
  ].join(', ')
}

function formatAvatarRetrievalAssembly(turnPayload: TurnCompletedEventPayload): string | null {
  const retrieval = turnPayload.contextSelection?.retrieval
  if (!retrieval) return null

  const selectedTotal =
    retrieval.selectedForAssemblyCounts.memory +
    retrieval.selectedForAssemblyCounts.world +
    retrieval.selectedForAssemblyCounts.media
  const includedTotal =
    retrieval.includedCounts.memory +
    retrieval.includedCounts.world +
    retrieval.includedCounts.media
  const omittedCounts = retrieval.omittedByAssemblyCounts ?? { memory: 0, world: 0, media: 0 }
  const omittedTotal = omittedCounts.memory + omittedCounts.world + omittedCounts.media
  const excludedCounts = retrieval.excludedByVisibilityCounts ?? { memory: 0, world: 0, media: 0 }
  const excludedTotal = excludedCounts.memory + excludedCounts.world + excludedCounts.media

  return [
    `Avatar retrieval assembly: ${String(selectedTotal)} hit${selectedTotal === 1 ? '' : 's'} selected for assembly`,
    `${String(includedTotal)} included in the final avatar input`,
    `${String(excludedTotal)} excluded by avatar visibility`,
    `${String(omittedTotal)} omitted during final assembly`,
  ].join(', ')
}

// eslint-disable-next-line complexity
function describeRecordedAvatarContext(
  avatarContext: NonNullable<TurnCompletedEventPayload['avatarContext']>,
  avatarNameById: Map<string, string>,
  knowledgeSourceNameById: Map<string, string>,
): { summary: string[]; retrieval: RetrievalTraceItem[] } {
  const lines = [
    `Avatar input summary: ${String(avatarContext.recentExchanges.length)} exchange(s), ${String(avatarContext.longTermFacts.length)} long-term fact(s), GM note ${avatarContext.gmNotes ? 'present' : 'absent'}, user persona ${avatarContext.userPersona ? 'present' : 'absent'}.`,
  ]
  if (avatarContext.workingMemory.avatar?.summary || avatarContext.workingMemory.session?.summary) {
    lines.push(
      `Avatar working memory: ${avatarContext.workingMemory.avatar?.summary ?? avatarContext.workingMemory.session?.summary ?? '-'}`,
    )
  }
  const knowledgeItems = avatarContext.knowledge
    ? [
        ...avatarContext.knowledge.memory,
        ...avatarContext.knowledge.world,
        ...avatarContext.knowledge.media,
      ]
    : []
  return {
    summary: lines,
    retrieval: knowledgeItems.map((item) =>
      toRetrievalTraceItem(item, avatarNameById, knowledgeSourceNameById),
    ),
  }
}

// eslint-disable-next-line complexity
function describeRecordedGmContext(
  gmContext: NonNullable<GmSessionEventPayload['gmContext']>,
  avatarNameById: Map<string, string>,
  knowledgeSourceNameById: Map<string, string>,
): { summary: string[]; retrieval: RetrievalTraceItem[] } {
  const knowledgeItems = [
    ...(gmContext.knowledge?.memory ?? []),
    ...(gmContext.knowledge?.world ?? []),
    ...(gmContext.knowledge?.media ?? []),
  ]
  const activeAvatar =
    gmContext.currentState.currentAvatarId === undefined
      ? 'none recorded'
      : formatAvatar(gmContext.currentState.currentAvatarId, avatarNameById)
  const lines = [
    `GM input summary: ${String(gmContext.recentMessages.length)} message(s), ${String(gmContext.memory.longTermFacts?.length ?? 0)} long-term fact(s), user persona ${gmContext.userPersona ? 'present' : 'absent'}, active avatar ${activeAvatar}.`,
  ]
  if (gmContext.memory.workingSummary) {
    lines.push(`GM working memory: ${gmContext.memory.workingSummary}`)
  }
  return {
    summary: lines,
    retrieval: knowledgeItems.map((item) =>
      toRetrievalTraceItem(item, avatarNameById, knowledgeSourceNameById),
    ),
  }
}

function toRetrievalTraceItem(
  item: {
    knowledgeType: 'memory' | 'world' | 'media'
    sourceId: string
    chunkId: string
    score?: number
    reason?: string
    visibleToAvatarIds?: string[]
  },
  avatarNameById: Map<string, string>,
  knowledgeSourceNameById: Map<string, string>,
): RetrievalTraceItem {
  const sourceName = knowledgeSourceNameById.get(item.sourceId) ?? item.sourceId
  const access =
    item.visibleToAvatarIds === undefined || item.visibleToAvatarIds.length === 0
      ? 'all avatars'
      : item.visibleToAvatarIds
          .map((avatarId) => avatarNameById.get(avatarId) ?? avatarId)
          .join(',')
  return {
    knowledgeType: item.knowledgeType,
    sourceName,
    chunkId: item.chunkId,
    access,
    ...(item.score !== undefined ? { score: item.score } : {}),
    matchBasis: formatMatchBasis(item.reason),
  }
}

function formatMatchBasis(reason: string | undefined): string {
  if (reason === undefined || reason.length === 0) return 'not recorded'
  return reason
    .split('+')
    .map((part) => {
      if (part === 'token-overlap') return 'keyword match'
      if (part === 'user-match') return 'same user'
      if (part === 'session-match') return 'same session'
      if (part === 'conversation-match') return 'same conversation'
      if (part === 'tag-match') return 'tag match'
      return part.replaceAll('_', ' ')
    })
    .join(', ')
}

function isGmPayload(payload: SessionEventRecord['payload']): payload is GmSessionEventPayload {
  return 'interactionCount' in payload
}

function isTurnPayload(
  payload: SessionEventRecord['payload'],
): payload is TurnCompletedEventPayload {
  return 'conversationId' in payload
}
