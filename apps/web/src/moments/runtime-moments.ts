import { isMediaCuePayload, type MediaCuePayload, type RuntimeEvent } from '@gami/shared'

export type RuntimeMoment = {
  momentId: string
  kind: 'unlocked' | 'suggested'
  avatarId: string
}

/** A media cue waiting or playing; `receivedAt` measures the player-side latency. */
export type MediaMoment = {
  cue: MediaCuePayload
  receivedAt: number
  started: boolean
}

export type RuntimeMomentsState = {
  sessionId: string | null
  queue: RuntimeMoment[]
  /** Media cues in arrival order; the head plays first. */
  media: MediaMoment[]
  seenEventIds: ReadonlySet<string>
}

export type MomentDisplayContext = {
  /** True while the character is thinking or speaking: moments wait for the turn to finish. */
  busy: boolean
  activeAvatarId: string | null
  /** Avatars the player can currently see; a moment waits until its avatar is listed. */
  availableAvatarIds: readonly string[]
}

export function createRuntimeMomentsState(sessionId: string | null): RuntimeMomentsState {
  return { sessionId, queue: [], media: [], seenEventIds: new Set() }
}

/** Queues narrative moments from GM events of this session; duplicates and other events are ignored. */
export function receiveRuntimeEvent(
  state: RuntimeMomentsState,
  event: RuntimeEvent,
): RuntimeMomentsState {
  if (event.sessionId !== state.sessionId || state.seenEventIds.has(event.eventId)) return state
  if (event.type === 'runtime.media_cue') return receiveMediaCue(state, event, Date.now())
  const moments = toMoments(event)
  if (moments.length === 0) return state
  const queued = new Set(state.queue.map((moment) => `${moment.kind}:${moment.avatarId}`))
  return {
    ...state,
    queue: [
      ...state.queue,
      ...moments.filter((moment) => !queued.has(`${moment.kind}:${moment.avatarId}`)),
    ],
    seenEventIds: new Set([...state.seenEventIds, event.eventId]),
  }
}

/** Cues are de-duplicated by `cueId`, whatever event carried them. */
function receiveMediaCue(
  state: RuntimeMomentsState,
  event: RuntimeEvent,
  receivedAt: number,
): RuntimeMomentsState {
  const cue = event.payload
  if (!isMediaCuePayload(cue) || state.seenEventIds.has(cue.cueId)) return state
  return {
    ...state,
    media: [...state.media, { cue, receivedAt, started: false }],
    seenEventIds: new Set([...state.seenEventIds, event.eventId, cue.cueId]),
  }
}

/**
 * The cue to play now. A cue never starts while the character thinks or speaks; once started it
 * stays until it ends, whatever happens in the conversation.
 */
export function currentMediaMoment(
  state: RuntimeMomentsState,
  context: Pick<MomentDisplayContext, 'busy'>,
): MediaMoment | null {
  const head = state.media[0]
  if (head === undefined) return null
  return head.started || !context.busy ? head : null
}

export function markMediaStarted(state: RuntimeMomentsState, cueId: string): RuntimeMomentsState {
  return {
    ...state,
    media: state.media.map((moment) =>
      moment.cue.cueId === cueId ? { ...moment, started: true } : moment,
    ),
  }
}

export function finishMedia(state: RuntimeMomentsState, cueId: string): RuntimeMomentsState {
  return { ...state, media: state.media.filter((moment) => moment.cue.cueId !== cueId) }
}

export function dismissMoment(state: RuntimeMomentsState, momentId: string): RuntimeMomentsState {
  return { ...state, queue: state.queue.filter((moment) => moment.momentId !== momentId) }
}

/** The moment to show now, or null while the character is busy or nothing is displayable. */
export function visibleMoment(
  state: RuntimeMomentsState,
  context: MomentDisplayContext,
): RuntimeMoment | null {
  if (context.busy) return null
  return (
    state.queue.find(
      (moment) =>
        context.availableAvatarIds.includes(moment.avatarId) &&
        !(moment.kind === 'suggested' && moment.avatarId === context.activeAvatarId),
    ) ?? null
  )
}

function toMoments(event: RuntimeEvent): RuntimeMoment[] {
  if (event.type === 'runtime.avatar_unlocked') {
    const ids = event.payload['unlockedAvatarIds']
    if (!Array.isArray(ids)) return []
    return ids
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .map((avatarId) => ({ momentId: `${event.eventId}:${avatarId}`, kind: 'unlocked', avatarId }))
  }
  if (event.type === 'runtime.avatar_suggested') {
    const avatarId = event.payload['suggestedAvatarId']
    if (typeof avatarId !== 'string' || avatarId.length === 0) return []
    return [{ momentId: event.eventId, kind: 'suggested', avatarId }]
  }
  return []
}
