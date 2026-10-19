import { describe, expect, it, vi } from 'vitest'
import type { RuntimeEvent } from '@gami/shared'
import { makeAvatarConfig } from '../../../domain/avatar/avatar.fixtures.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryGmStateRepository } from '../../../infrastructure/db/in-memory-gm-state.repository.js'
import { InMemoryMediaAssetRepository } from '../../../infrastructure/db/in-memory-media-asset.repository.js'
import { InMemoryMessageRepository } from '../../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { InMemorySessionEventPublisher } from '../../../infrastructure/events/in-memory-session-event-publisher.js'
import { makeMediaAsset } from '../../../test-utils/media.js'
import { MediaCueService } from '../../services/media/media-cue.service.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const UNLOCK_OUTPUT = {
  dialogueControl: { mode: 'avatar_guided', askFollowUp: false },
  retrievalPlan: { required: false },
  directorNotes: 'Bring Theo in.',
  routing: { action: 'unlock', unlockDecisions: [{ avatarId: 'avatar_2', reason: 'Asked for' }] },
  progressionUpdate: { progression: 'none' },
}

function setup(gmOutput: object = UNLOCK_OUTPUT) {
  const assets = new InMemoryMediaAssetRepository([
    makeMediaAsset({ assetId: 'media_reveal', kind: 'video', mimeType: 'video/mp4' }),
    makeMediaAsset({ assetId: 'media_cut' }),
    makeMediaAsset({ assetId: 'media_chalet', cueable: true, description: 'The chalet in snow' }),
  ])
  const gmStates = new InMemoryGmStateRepository()
  const complete = vi.fn().mockResolvedValue({
    content: JSON.stringify(gmOutput),
    model: 'null-model',
    inputTokens: 1,
    outputTokens: 1,
    latencyMs: 1,
  })
  const sessions = new InMemorySessionRepository([
    {
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: 'scenario_1',
      activeAvatarId: 'avatar_1',
      unlockedAvatarIds: ['avatar_1'],
      status: 'active',
      startedAt: '2026-10-19T10:00:00.000Z',
      lastActivityAt: '2026-10-19T10:00:00.000Z',
    },
  ])
  const eventLog = new InMemoryEventLogRepository()
  const publisher = new InMemorySessionEventPublisher()
  const events: RuntimeEvent[] = []
  publisher.subscribe('session_1', (event) => {
    events.push(event)
  })
  const useCase = new RunGameMasterUseCase(
    gmStates,
    sessions,
    new InMemoryAvatarRepository([
      makeAvatarConfig({ avatarId: 'avatar_1', scenarioId: 'scenario_1', name: 'Ava' }),
      makeAvatarConfig({
        avatarId: 'avatar_2',
        scenarioId: 'scenario_1',
        name: 'Theo',
        config: { mediaTriggers: { onUnlock: 'media_reveal', onSwitchTo: 'media_cut' } },
      }),
    ]),
    { complete },
    { trace: vi.fn(), flush: vi.fn() },
    {
      eventLogRepository: eventLog,
      sessionEventPublisher: publisher,
      messageRepository: new InMemoryMessageRepository([
        {
          messageId: 'msg_1',
          conversationId: 'conversation_1',
          role: 'user',
          content: 'Can Theo join us?',
          createdAt: '2026-10-19T10:00:00.000Z',
        },
        {
          messageId: 'msg_2',
          conversationId: 'conversation_1',
          role: 'avatar',
          content: 'Theo can help.',
          createdAt: '2026-10-19T10:00:01.000Z',
        },
      ]),
      mediaAssetRepository: assets,
      mediaCueService: new MediaCueService(assets, eventLog, publisher),
    },
  )
  const run = () =>
    useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      conversationId: 'conversation_1',
      userMessageText: 'Can Theo join us?',
      turnIndex: 1,
      correlationId: 'corr_1',
    })
  /** What a session reset leaves behind: initial unlocks and a reset boundary in the log. */
  const reset = async () => {
    await new Promise((resolve) => setTimeout(resolve, 2))
    await sessions.update('session_1', { unlockedAvatarIds: ['avatar_1'] })
    await eventLog.append({
      sessionId: 'session_1',
      type: 'session_reset',
      severity: 'info',
      payload: {},
    })
    await new Promise((resolve) => setTimeout(resolve, 2))
  }
  return { run, reset, events, eventLog, gmStates, complete }
}

function cues(events: RuntimeEvent[]): unknown[] {
  return events.filter((event) => event.type === 'runtime.media_cue').map((event) => event.payload)
}

describe('RunGameMasterUseCase — media triggers', () => {
  it('publishes the unlock cue after the unlock event, and only once across replays', async () => {
    const { run, events, eventLog } = setup()

    await run()
    await run()

    const types = events.map((event) => event.type)
    expect(types.filter((type) => type === 'runtime.media_cue')).toHaveLength(1)
    expect(types.indexOf('runtime.media_cue')).toBeGreaterThan(
      types.indexOf('runtime.avatar_unlocked'),
    )
    expect(events.find((event) => event.type === 'runtime.media_cue')?.payload).toMatchObject({
      origin: 'avatar_unlocked',
      display: 'fullscreen',
      asset: { assetId: 'media_reveal' },
    })
    expect(eventLog.getAll().filter((event) => event.type === 'media.cue_emitted')).toHaveLength(1)
  })

  it('replays the unlock media after a session reset', async () => {
    const { run, reset, events } = setup()

    await run()
    await reset()
    await run()

    expect(cues(events).map((cue) => (cue as { origin: string }).origin)).toEqual([
      'avatar_unlocked',
      'avatar_unlocked',
    ])
  })

  it('cues the switch-to media when the GM switches to an unlocked avatar', async () => {
    const { run, events } = setup({
      ...UNLOCK_OUTPUT,
      routing: {
        action: 'unlock_and_switch',
        avatarId: 'avatar_2',
        unlockDecisions: [{ avatarId: 'avatar_2', reason: 'Asked for' }],
      },
    })

    await run()

    expect(
      events
        .filter((event) => event.type === 'runtime.media_cue')
        .map((event) => event.payload['origin']),
    ).toEqual(['avatar_unlocked', 'avatar_switched'])
  })
})

const STAY_OUTPUT = {
  dialogueControl: { mode: 'avatar_guided', askFollowUp: false },
  retrievalPlan: { required: false },
  directorNotes: 'Let the chalet come back to you.',
  progressionUpdate: { progression: 'increase' },
}

function decisionOf(eventLog: InMemoryEventLogRepository): Record<string, unknown> {
  const triggered = eventLog.getAll().find((event) => event.type === 'gm_triggered')
  return triggered?.payload['decision'] as Record<string, unknown>
}

describe('RunGameMasterUseCase — GM media cue', () => {
  it('shows the GM the cue-able catalogue and the cue rules', async () => {
    const { run, complete } = setup(STAY_OUTPUT)

    await run()

    const request = complete.mock.calls[0]?.[0] as {
      systemPrompt: string
      messages: Array<{ content: string }>
    }
    expect(request.systemPrompt).toContain('Media cues:')
    expect(request.messages[0]?.content).toContain('- media_chalet (image): The chalet in snow')
    expect(request.messages[0]?.content).not.toContain('media_reveal')
  })

  it('emits one game_master cue for an accepted asset, once even when the run replays', async () => {
    const { run, events, eventLog } = setup({
      ...STAY_OUTPUT,
      mediaCue: { assetId: 'media_chalet' },
    })

    await run()
    await run()

    expect(cues(events)).toEqual([
      expect.objectContaining({ origin: 'game_master', display: 'overlay' }),
    ])
    expect(decisionOf(eventLog)).toMatchObject({
      mediaCueAssetId: 'media_chalet',
      mediaCueOutcome: 'accepted',
    })
  })

  it('offers an already cued asset again after a session reset', async () => {
    const { run, reset, complete } = setup({
      ...STAY_OUTPUT,
      mediaCue: { assetId: 'media_chalet' },
    })
    const lastPrompt = () =>
      (complete.mock.calls.at(-1)?.[0] as { messages: Array<{ content: string }> }).messages[0]
        ?.content ?? ''

    await run()
    await run()
    expect(lastPrompt()).not.toContain('media_chalet')

    await reset()
    await run()
    expect(lastPrompt()).toContain('media_chalet')
  })

  it('ignores a cue outside the catalogue without changing the other decisions', async () => {
    const rejected = setup({ ...STAY_OUTPUT, mediaCue: { assetId: 'media_reveal' } })
    const plain = setup(STAY_OUTPUT)

    await rejected.run()
    await plain.run()

    expect(cues(rejected.events)).toEqual([])
    expect(decisionOf(rejected.eventLog)).toMatchObject({
      mediaCueOutcome: 'rejected_not_in_catalogue',
      progression: 'increase',
    })
    const withoutTimestamps = async (repository: InMemoryGmStateRepository) => {
      const state = await repository.findBySessionId('session_1')
      return {
        ...state,
        nextTurnOrchestration: { ...state?.nextTurnOrchestration, generatedAt: '' },
      }
    }
    expect(await withoutTimestamps(rejected.gmStates)).toEqual(
      await withoutTimestamps(plain.gmStates),
    )
  })
})
