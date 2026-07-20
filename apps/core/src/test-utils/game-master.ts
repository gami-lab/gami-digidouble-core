import type { GameMasterInput } from '../domain/game-master/game-master.types.js'

export function readRenderedGameMasterInput(
  request: { messages: Array<{ content: string }> } | undefined,
): GameMasterInput {
  return JSON.parse(request?.messages[0]?.content ?? '{}') as GameMasterInput
}
