import { ContextEngine } from '../../../domain/context/context-engine.service.js'
import type { GmContextSnapshot } from '../../../domain/context/session-context.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { RunGameMasterInput } from './run-game-master.types.js'
import { toGameMasterAvailableAvatars } from './run-game-master.avatar-unlocks.js'
import type { MemorySelectionService } from '../../services/memory-selection.service.js'

export function resolveAssembledGmContext(args: {
  input: RunGameMasterInput
  session: Session | null
  currentState: GameMasterState
  scenarioAvatars: AvatarConfig[]
  scenarioContext: { description?: string; goals?: string[] }
  recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>
  contextEngine: ContextEngine
  memorySelectionService: MemorySelectionService
}): GmContextSnapshot {
  if (args.input.assembledContext !== undefined) return args.input.assembledContext.gm

  const availableAvatars = toGameMasterAvailableAvatars(args.scenarioAvatars, args.session)
  return args.contextEngine.assemble({
    sessionId: args.input.sessionId,
    activeAvatarId: args.input.avatarId,
    recentMessages: args.recentMessages,
    scenario: {
      scenarioId: args.input.scenarioId,
      ...(args.scenarioContext.description !== undefined
        ? { description: args.scenarioContext.description }
        : {}),
      ...(args.scenarioContext.goals !== undefined ? { goals: args.scenarioContext.goals } : {}),
    },
    availableAvatars,
    gmState: args.currentState,
    extensions: {
      memory:
        args.input.selectedMemory !== undefined
          ? args.memorySelectionService.toAvatarMemorySnapshot(args.input.selectedMemory)
          : undefined,
      retrieval: undefined,
      userPersona: args.input.userPersona ?? null,
      gmDirective: args.session?.gmNotes ?? null,
    },
  }).gm
}
