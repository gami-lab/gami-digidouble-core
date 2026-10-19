import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type {
  GameMasterMediaCatalogueEntry,
  MediaCueDecision,
} from '../../../domain/game-master/game-master.types.js'
import { readMediaTriggers } from '../../../domain/media/avatar-media-triggers.js'
import type { MediaCueService } from '../../services/media/media-cue.service.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import { loadGameMasterMediaCatalogue } from '../../services/media/media-catalogue.js'
import type { RunGameMasterInput } from './run-game-master.types.js'

/**
 * Unlock and GM-switch media follow their runtime events, then the GM's own cue. An avatar unlocks
 * once per session and a GM run switches and cues at most once, which keys each cue to its event.
 */
export async function emitTriggeredMediaCues(
  cueService: MediaCueService,
  args: {
    input: RunGameMasterInput
    scenarioAvatars: AvatarConfig[]
    unlockedAvatarIds: string[]
    switchedAvatarId: string | undefined
    mediaCue: MediaCueDecision | undefined
  },
): Promise<void> {
  const { input, scenarioAvatars, unlockedAvatarIds, switchedAvatarId, mediaCue } = args
  const triggersOf = (avatarId: string) =>
    readMediaTriggers(scenarioAvatars.find((avatar) => avatar.avatarId === avatarId)?.config ?? {})
  const base = {
    sessionId: input.sessionId,
    scenarioId: input.scenarioId,
    correlationId: input.correlationId,
    ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
  }
  for (const avatarId of unlockedAvatarIds) {
    const assetId = triggersOf(avatarId)?.onUnlock
    if (assetId === undefined) continue
    await cueService.emit({
      ...base,
      assetId,
      origin: 'avatar_unlocked',
      triggerKey: `unlock:${input.sessionId}:${avatarId}`,
    })
  }
  const switchAssetId =
    switchedAvatarId === undefined ? undefined : triggersOf(switchedAvatarId)?.onSwitchTo
  if (switchedAvatarId !== undefined && switchAssetId !== undefined) {
    await cueService.emit({
      ...base,
      assetId: switchAssetId,
      origin: 'avatar_switched',
      triggerKey: `switch:${input.correlationId}:${switchedAvatarId}`,
    })
  }
  if (mediaCue !== undefined) {
    await cueService.emit({
      ...base,
      assetId: mediaCue.assetId,
      origin: 'game_master',
      triggerKey: `gm:${input.correlationId}`,
    })
  }
}

/** A catalogue failure only removes the media option from this run. */
export async function loadMediaCatalogue(
  mediaAssetRepository: IMediaAssetRepository | undefined,
  eventLogRepository: IEventLogRepository | undefined,
  input: RunGameMasterInput,
): Promise<GameMasterMediaCatalogueEntry[]> {
  if (mediaAssetRepository === undefined) return []
  try {
    return await loadGameMasterMediaCatalogue(
      mediaAssetRepository,
      eventLogRepository,
      input.scenarioId,
      input.sessionId,
    )
  } catch (error: unknown) {
    console.warn('[GM] Media catalogue unavailable; running without media cues:', error)
    return []
  }
}
