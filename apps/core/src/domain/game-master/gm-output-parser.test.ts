import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeParseGameMasterOutput } from './gm-output-parser.js'

const validDialogueControl = {
  dialogueControl: { mode: 'user_led', askFollowUp: false },
  retrievalPlan: { required: false },
  directorNotes: 'Keep the next answer focused on the current subject.',
  progressionUpdate: { progression: 'none' },
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
          retrievalPlan: { required: false },
          directorNotes: 'Keep the next answer focused on the current subject.',
          progressionUpdate: { progression: 'none' },
        }),
      )

      expect(parsed?.dialogueControl).toEqual({ mode, askFollowUp: false })
    },
  )

  it('requires retrievalPlan, directorNotes, and progressionUpdate', () => {
    const parsed = safeParseGameMasterOutput(JSON.stringify(validDialogueControl))

    expect(parsed).toMatchObject({
      dialogueControl: validDialogueControl.dialogueControl,
      retrievalPlan: { required: false },
      progressionUpdate: { progression: 'none' },
    })
    expect(parsed).toHaveProperty('directorNotes', validDialogueControl.directorNotes)
    expect(parsed).not.toHaveProperty('routing')
  })

  it.each(['retrievalPlan', 'progressionUpdate'])('rejects missing required field %s', (field) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const output: Record<string, unknown> = { ...validDialogueControl }
    const { [field]: removedField, ...withoutField } = output
    expect(removedField).toBeDefined()

    expect(safeParseGameMasterOutput(JSON.stringify(withoutField))).toBeNull()
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

  it('rejects obsolete top-level application and memory fields', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
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

    expect(parsed).toBeNull()
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
