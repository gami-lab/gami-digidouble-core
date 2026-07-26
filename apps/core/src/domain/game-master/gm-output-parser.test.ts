import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeParseGameMasterOutput } from './gm-output-parser.js'

const validDialogueControl = {
  dialogueControl: { mode: 'user_led', askFollowUp: false },
  directorNotes: 'Keep the next answer focused on the current subject.',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('safeParseGameMasterOutput', () => {
  it('requires dialogueControl and its explicit askFollowUp field', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(safeParseGameMasterOutput('{}')).toBeNull()
    expect(
      safeParseGameMasterOutput(JSON.stringify({ dialogueControl: { mode: 'user_led' } })),
    ).toBeNull()
  })

  it.each(['user_led', 'avatar_guided', 'avatar_led', 'repair', 'transition'])(
    'accepts dialogue mode %s',
    (mode) => {
      const parsed = safeParseGameMasterOutput(
        JSON.stringify({
          dialogueControl: { mode, askFollowUp: false },
          directorNotes: 'Keep the next answer focused on the current subject.',
        }),
      )

      expect(parsed?.dialogueControl).toEqual({ mode, askFollowUp: false })
    },
  )

  it('requires directorNotes and accepts optional retrieval, routing, and progression fields', () => {
    const parsed = safeParseGameMasterOutput(JSON.stringify(validDialogueControl))

    expect(parsed).toMatchObject({
      dialogueControl: validDialogueControl.dialogueControl,
      retrievalPlan: { required: false },
      progressionUpdate: { progression: 'none' },
    })
    expect(parsed).toHaveProperty('directorNotes', validDialogueControl.directorNotes)
    expect(parsed).not.toHaveProperty('routing')
  })

  it.each([undefined, '', '   '])('rejects missing or blank directorNotes: %j', (directorNotes) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const output: Record<string, unknown> = { ...validDialogueControl }
    if (directorNotes === undefined) {
      delete output.directorNotes
    } else {
      output.directorNotes = directorNotes
    }

    expect(safeParseGameMasterOutput(JSON.stringify(output))).toBeNull()
  })

  it('rejects invalid dialogue modes and invalid retrieval shapes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(
      safeParseGameMasterOutput(
        JSON.stringify({ dialogueControl: { mode: 'forced', askFollowUp: false } }),
      ),
    ).toBeNull()
    expect(
      safeParseGameMasterOutput(
        JSON.stringify({
          ...validDialogueControl,
          retrievalPlan: { required: 'yes' },
        }),
      ),
    ).toBeNull()
  })

  it('ignores obsolete top-level application and memory fields', () => {
    const parsed = safeParseGameMasterOutput(
      JSON.stringify({
        ...validDialogueControl,
        avatarId: 'obsolete_avatar',
        nextAvatarId: 'obsolete_next_avatar',
        conversationMode: 'obsolete_mode',
        topicCovered: 'obsolete_topic',
        interactionIncrement: 4,
        suggestedAvatarId: 'obsolete_suggestion',
        suggestedAvatarReason: 'obsolete_reason',
        unlockAvatarIds: ['obsolete_unlock'],
        transitionReason: 'obsolete_transition',
      }),
    )

    expect(parsed).not.toHaveProperty('avatarId')
    expect(parsed).not.toHaveProperty('nextAvatarId')
    expect(parsed).not.toHaveProperty('conversationMode')
    expect(parsed).not.toHaveProperty('topicCovered')
    expect(parsed).not.toHaveProperty('interactionIncrement')
    expect(parsed).not.toHaveProperty('suggestedAvatarId')
    expect(parsed).not.toHaveProperty('suggestedAvatarReason')
    expect(parsed).not.toHaveProperty('unlockAvatarIds')
    expect(parsed).not.toHaveProperty('transitionReason')
  })

  it('falls invalid routing back to stay', () => {
    expect(
      safeParseGameMasterOutput(
        JSON.stringify({ ...validDialogueControl, routing: { action: 'teleport' } }),
      ),
    ).toMatchObject({ routing: { action: 'stay' } })
    expect(
      safeParseGameMasterOutput(JSON.stringify({ ...validDialogueControl, routing: 'invalid' })),
    ).toMatchObject({ routing: { action: 'stay' } })
  })
})
