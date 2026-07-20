import { describe, expect, it } from 'vitest'
import { buildGameMasterSystemPrompt } from './gm-prompt.service.js'

describe('buildGameMasterSystemPrompt', () => {
  it('renders the static prompt in the EPIC 8.3 section order', () => {
    const prompt = buildGameMasterSystemPrompt()

    expectSectionOrder(prompt, [
      '## Role',
      '## Objectives',
      '## Decision Policies',
      '## Output Contract',
    ])
  })

  it('keeps the Game Master role boundary and stability objectives explicit', () => {
    const prompt = buildGameMasterSystemPrompt()

    expect(prompt).toContain(
      'You are the Game Master, a silent director for an avatar conversation.',
    )
    expect(prompt).toContain('- Never speak directly to the user and never write the Avatar reply.')
    expect(prompt).toContain('1. Preserve stable orchestration and conversation continuity.')
    expect(prompt).toContain(
      '2. Keep the current avatar and conversation unless the latest evidence supports a change.',
    )
    expect(prompt).toContain(
      '- Bias toward conversationMode "continue" unless there is clear evidence for a switch.',
    )
  })

  it('preserves validation-critical output instructions', () => {
    const prompt = buildGameMasterSystemPrompt()

    expect(prompt).toContain(
      'Output ONLY a valid JSON object. Do not return prose, markdown, or a code fence.',
    )
    expect(prompt).toContain('- avatarId must be one of the avatarIds listed in availableAvatars.')
    expect(prompt).toContain(
      '- unlockAvatarIds may include only locked avatarIds listed in availableAvatars.',
    )
    expect(prompt).toContain(
      '- When you unlock an avatar, include unlockDecisions with one short safe reason per unlocked avatar.',
    )
    expect(prompt).toContain(
      '- Set nextAvatarId only when conversationMode is "new" and a new conversation should be opened.',
    )
    expect(prompt).toContain('- context.notes must be one sentence maximum.')
    expect(prompt).toContain('- stateUpdate.interactionIncrement must always be exactly 1.')
    expect(prompt).toContain('- nextAvatarId is valid only when conversationMode is "new".')
    expect(prompt).toContain('- unlockDecisions must accompany actual unlocks.')
    expect(prompt).toContain(
      'When userMessage.text is empty, no user message has been sent yet. Treat this as conversation opening guidance, and use context.notes to tell the Avatar how to open instead of reacting to a message.',
    )
    expect(prompt).toContain('"interactionIncrement": 1')
  })
})

function expectSectionOrder(prompt: string, sections: string[]): void {
  let previousIndex = -1

  for (const section of sections) {
    const index = prompt.indexOf(section)
    expect(index).toBeGreaterThan(previousIndex)
    previousIndex = index
  }
}
