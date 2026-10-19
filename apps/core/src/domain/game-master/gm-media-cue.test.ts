import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameMasterInput } from './game-master.types.js'
import { renderGameMasterInputForLlm } from './gm-input-renderer.js'
import { normalizeGameMasterOutput } from './gm-output-normalization.js'
import { safeParseGameMasterOutput } from './gm-output-parser.js'

const base = {
  dialogueControl: { mode: 'avatar_guided', askFollowUp: false },
  retrievalPlan: { required: false },
  directorNotes: 'Let the memory of the chalet surface.',
  progressionUpdate: { progression: 'increase', reason: 'The chalet was named.' },
}

const catalogue = [
  { assetId: 'media_chalet', kind: 'image' as const, description: 'The chalet under snow' },
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GM media cue output', () => {
  it('parses a cue alongside the other decisions', () => {
    const parsed = safeParseGameMasterOutput(
      JSON.stringify({ ...base, mediaCue: { assetId: ' media_chalet ' } }),
    )

    expect(parsed?.mediaCue).toEqual({ assetId: 'media_chalet' })
    expect(parsed?.progressionUpdate.progression).toBe('increase')
  })

  it.each([
    ['a string', 'media_chalet'],
    ['a missing id', {}],
    ['extra keys', { assetId: 'media_chalet', display: 'fullscreen' }],
    ['an empty id', { assetId: '  ' }],
  ])('drops a malformed cue (%s) and keeps every other decision', (_label, mediaCue) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const parsed = safeParseGameMasterOutput(JSON.stringify({ ...base, mediaCue }))

    expect(parsed).not.toBeNull()
    expect(parsed).not.toHaveProperty('mediaCue')
    expect(parsed?.directorNotes).toBe(base.directorNotes)
    expect(parsed?.progressionUpdate).toEqual(base.progressionUpdate)
  })

  it('keeps only cues naming an asset of the catalogue given to this run', () => {
    const parsed = safeParseGameMasterOutput(
      JSON.stringify({ ...base, mediaCue: { assetId: 'media_invented' } }),
    )
    const accepted = safeParseGameMasterOutput(
      JSON.stringify({ ...base, mediaCue: { assetId: 'media_chalet' } }),
    )
    if (parsed === null || accepted === null) throw new Error('expected valid GM output')

    expect(normalizeGameMasterOutput(parsed, [], catalogue)).not.toHaveProperty('mediaCue')
    expect(normalizeGameMasterOutput(accepted, [], catalogue).mediaCue).toEqual({
      assetId: 'media_chalet',
    })
    expect(normalizeGameMasterOutput(accepted, [])).not.toHaveProperty('mediaCue')
  })
})

describe('GM media catalogue input', () => {
  function input(mediaCatalogue?: GameMasterInput['context']['mediaCatalogue']): GameMasterInput {
    return {
      session: { sessionId: 'session_1', turnIndex: 1, activeAvatarId: 'avatar_1' },
      userMessage: { text: 'Tell me about the chalet.' },
      state: { progression: '', interactionCount: 1 },
      context: {
        experience: { scenarioId: 'scenario_1' },
        conversationState: { recentMessages: [], recentExchanges: [], episodicMemories: [] },
        availableAvatars: [{ avatarId: 'avatar_1', name: 'Max' }],
        ...(mediaCatalogue !== undefined ? { mediaCatalogue } : {}),
      },
    }
  }

  it('lists the catalogue in the experience context only when one exists', () => {
    expect(renderGameMasterInputForLlm(input(catalogue))).toContain(
      '### Media Catalogue\n- media_chalet (image): The chalet under snow',
    )
    expect(renderGameMasterInputForLlm(input())).not.toContain('Media')
  })
})
