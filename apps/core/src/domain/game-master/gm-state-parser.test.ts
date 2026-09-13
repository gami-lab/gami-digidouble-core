import { describe, expect, it } from 'vitest'
import { parsePersistedGameMasterOrchestration } from './gm-state-parser.js'

const validOrchestration = {
  activeAvatarId: 'avatar_1',
  generatedAfterTurn: 3,
  generatedAt: '2026-07-25T10:00:00.000Z',
  dialogueControl: { mode: 'repair', askFollowUp: false },
  retrievalPlan: { required: true, queries: ['Mona location'] },
  directorNotes: 'Keep the next answer focused on the current subject.',
  progressionUpdate: { progression: 'none' },
}

describe('parsePersistedGameMasterOrchestration', () => {
  it('parses the current orchestration shape', () => {
    expect(parsePersistedGameMasterOrchestration(validOrchestration)).toEqual(validOrchestration)
  })

  it.each(['dialogueControl', 'retrievalPlan', 'progressionUpdate'])(
    'rejects a current orchestration without %s',
    (field) => {
      const invalid: Record<string, unknown> = Object.fromEntries(
        Object.entries(validOrchestration).filter(([key]) => key !== field),
      )

      expect(parsePersistedGameMasterOrchestration(invalid)).toBeUndefined()
    },
  )

  it('rejects pre-current fields instead of normalizing them', () => {
    expect(
      parsePersistedGameMasterOrchestration({
        ...validOrchestration,
        conversationMode: 'repair',
        stateUpdate: { activeAvatarId: 'avatar_2' },
        nextAvatarId: 'avatar_2',
      }),
    ).toBeUndefined()
  })

  it('rejects malformed nested current fields', () => {
    expect(
      parsePersistedGameMasterOrchestration({
        ...validOrchestration,
        retrievalPlan: { required: 'yes' },
      }),
    ).toBeUndefined()
  })
})
