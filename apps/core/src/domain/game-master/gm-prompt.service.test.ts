import { describe, expect, it } from 'vitest'
import { buildGameMasterSystemPrompt, type GmPromptAvatarContext } from './gm-prompt.service.js'

/* eslint-disable max-lines-per-function */
const SINGLE_AVATAR: GmPromptAvatarContext = { activeAvatarCount: 1, hasLockedAvatars: false }
const MULTI_NO_LOCKED: GmPromptAvatarContext = { activeAvatarCount: 2, hasLockedAvatars: false }
const MULTI_WITH_LOCKED: GmPromptAvatarContext = { activeAvatarCount: 2, hasLockedAvatars: true }

describe('buildGameMasterSystemPrompt', () => {
  it('renders the static prompt sections in order', () => {
    const prompt = buildGameMasterSystemPrompt(MULTI_WITH_LOCKED)

    expectSectionOrder(prompt, [
      '## Role',
      '## Responsibilities',
      '## Fact Discipline',
      '## Decision Policies',
      '## Output Contract',
    ])
  })

  it('keeps the async Game Master role boundary explicit', () => {
    const prompt = buildGameMasterSystemPrompt(MULTI_WITH_LOCKED)
    const roleSection = readSection(prompt, '## Role', '## Responsibilities')

    expect(roleSection).toContain(
      'You are the asynchronous Game Master for an Avatar conversation.',
    )
    expect(roleSection).toContain('You do not write the Avatar reply.')
  })

  it('documents fact discipline and ownership boundaries', () => {
    const prompt = buildGameMasterSystemPrompt(MULTI_WITH_LOCKED)
    const factSection = readSection(prompt, '## Fact Discipline', '## Decision Policies')

    expect(factSection).toContain('canonical world facts')
    expect(factSection).toContain(
      'A previous Avatar statement is not automatically a true world fact.',
    )
    expect(factSection).toContain(
      'Do not report covered topics, persistent facts, unresolved memory threads, or interaction increments.',
    )
  })

  it('documents dialogue control modes and retrieval planning guidance', () => {
    const prompt = buildGameMasterSystemPrompt(MULTI_WITH_LOCKED)
    const policySection = readSection(prompt, '## Decision Policies', '## Output Contract')

    expect(policySection).toContain('user_led: the user is directing the discussion')
    expect(policySection).toContain('repair: the next response must resolve a contradiction')
    expect(policySection).toContain('transition: the current subject should close')
    expect(policySection).toContain('retrievalPlan.required true when')
    expect(policySection).toContain(
      'Write every retrievalPlan query and requiredFact in the same language as context.experience.description',
    )
    expect(policySection).toContain('You do not perform retrieval yourself')
    expect(policySection).toContain('Omit directorNotes rather than restate permanent Avatar rules')
    expect(policySection).toContain(
      'When userMessage.text is empty, no user message has been sent yet. Treat this as conversation opening guidance, and use directorNotes to tell the Avatar how to open instead of reacting to a message.',
    )
  })

  it('includes routing guidance and unlock actions when locked avatars exist', () => {
    const prompt = buildGameMasterSystemPrompt(MULTI_WITH_LOCKED)

    expect(prompt).toContain('- stay does not require avatarId.')
    expect(prompt).toContain('- suggest and switch require an active, unlocked avatarId.')
    expect(prompt).toContain('- unlock requires a locked avatarId')
    expect(prompt).toContain('- unlock_and_switch requires a locked avatarId')
    expect(prompt).toContain(
      '\\"stay\\" | \\"suggest\\" | \\"switch\\" | \\"unlock\\" | \\"unlock_and_switch\\"',
    )
    expect(prompt).toContain('unlockDecisions')
  })

  it('omits unlock guidance and actions when no avatars are locked', () => {
    const prompt = buildGameMasterSystemPrompt(MULTI_NO_LOCKED)

    expect(prompt).toContain('- stay does not require avatarId.')
    expect(prompt).toContain('\\"stay\\" | \\"suggest\\" | \\"switch\\"')
    expect(prompt).not.toContain('unlock_and_switch')
    expect(prompt).not.toContain('unlockDecisions')
  })

  it('omits routing entirely for a single-Avatar scenario', () => {
    const prompt = buildGameMasterSystemPrompt(SINGLE_AVATAR)

    expect(prompt).not.toContain('Avatar routing:')
    expect(prompt).not.toContain('"routing"')
    expect(prompt).not.toContain('- suggest and switch require')
  })

  it('keeps the dynamic schema capability matrix exact', () => {
    const single = buildGameMasterSystemPrompt(SINGLE_AVATAR)
    const multiple = buildGameMasterSystemPrompt(MULTI_NO_LOCKED)
    const locked = buildGameMasterSystemPrompt(MULTI_WITH_LOCKED)

    expect(single).not.toContain('"routing"')
    expect(single).not.toContain('unlock')
    expect(multiple).toContain('\\"stay\\" | \\"suggest\\" | \\"switch\\"')
    expect(multiple).not.toContain('"unlock"')
    expect(locked).toContain(
      '\\"stay\\" | \\"suggest\\" | \\"switch\\" | \\"unlock\\" | \\"unlock_and_switch\\"',
    )
    expect(locked).toContain('unlockDecisions')
  })

  it('is materially smaller when routing is impossible', () => {
    const singleLength = buildGameMasterSystemPrompt(SINGLE_AVATAR).length
    const multiLength = buildGameMasterSystemPrompt(MULTI_WITH_LOCKED).length

    expect(singleLength).toBeLessThan(multiLength)
  })

  it('preserves validation-critical output instructions', () => {
    const prompt = buildGameMasterSystemPrompt(MULTI_WITH_LOCKED)

    expect(prompt).toContain(
      'Output ONLY a valid JSON object. Do not return prose, markdown, or a code fence.',
    )
    expect(prompt).toContain(
      '- askFollowUp must always be stated explicitly; never infer it from mode alone.',
    )
    expect(prompt).toContain(
      '- retrievalPlan.queries and requiredFacts should be omitted or empty when required is false.',
    )
    expect(prompt).toContain(
      '- routing.avatarId must be one of the Avatars listed as available for this turn.',
    )
    expect(prompt).toContain(
      '- unlockDecisions must accompany actual unlocks, one short safe reason each.',
    )
    expect(prompt).toContain(
      '- Do not include a routing target that repeats the current Avatar with no actual change.',
    )
    expect(prompt).toContain('"dialogueControl"')
    expect(prompt).toContain('"retrievalPlan"')
    expect(prompt).toContain('"progressionUpdate"')
    expect(prompt).not.toContain('priority')
    expect(prompt).not.toContain('interactionIncrement')
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

function readSection(prompt: string, startMarker: string, endMarker: string): string {
  const start = prompt.indexOf(startMarker)
  const end = prompt.indexOf(endMarker)

  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)

  return prompt.slice(start, end)
}
