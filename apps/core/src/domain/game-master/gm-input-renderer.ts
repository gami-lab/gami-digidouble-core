import type { GameMasterInput } from './game-master.types.js'

/**
 * Internal LLM rendering for the Game Master input contract.
 *
 * Ownership:
 * - Runtime input fields remain owned by GameMasterInput.
 * - This renderer only controls how that canonical contract is serialized for
 *   the prompt and must not introduce prompt-only fields.
 */
export function renderGameMasterInputForLlm(input: GameMasterInput): string {
  return JSON.stringify(input)
}
