import { describe, expect, it } from 'vitest'
import type { ApiResponse, ReportMediaPlaybackResponse } from '@gami/shared'
import { mediaCueEventId } from '../../application/services/media/media-cue.service.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { createServer } from '../server.js'
import { playerHeaders } from './test-auth.js'
import { TEST_CONFIG } from './test-config.js'

const CUE_ID = `cue_${'a'.repeat(32)}`

function session(sessionId: string, userId: string) {
  return {
    sessionId,
    userId,
    scenarioId: 'scenario_1',
    unlockedAvatarIds: [],
    status: 'active' as const,
    startedAt: '2026-10-19T10:00:00.000Z',
    lastActivityAt: '2026-10-19T10:00:00.000Z',
  }
}

async function makeApp() {
  const eventLog = new InMemoryEventLogRepository()
  await eventLog.appendOnce(mediaCueEventId(CUE_ID), {
    sessionId: 'session_mine',
    type: 'media.cue_emitted',
    severity: 'info',
    payload: { cueId: CUE_ID, assetId: 'media_1', origin: 'game_master' },
  })
  const app = createServer(TEST_CONFIG, {
    sessionRepository: new InMemorySessionRepository([
      session('session_mine', 'user_1'),
      session('session_other', 'user_2'),
    ]),
    eventLogRepository: eventLog,
  })
  return { app, eventLog }
}

function report(
  app: Awaited<ReturnType<typeof makeApp>>['app'],
  payload: object,
  sessionId = 'session_mine',
  headers: Record<string, string> = playerHeaders(),
  cueId = CUE_ID,
) {
  return app.inject({
    method: 'POST',
    url: `/v1/sessions/${sessionId}/media-cues/${cueId}/playback`,
    headers,
    payload,
  })
}

describe('media cue playback reports', () => {
  it('records each outcome once with the server-side cue-to-report time', async () => {
    const { app, eventLog } = await makeApp()

    const first = await report(app, { outcome: 'started', clientLatencyMs: 120 })
    const again = await report(app, { outcome: 'started', clientLatencyMs: 140 })
    await report(app, { outcome: 'completed' })

    expect(first.json<ApiResponse<ReportMediaPlaybackResponse>>().data).toEqual({ recorded: true })
    expect(again.json<ApiResponse<ReportMediaPlaybackResponse>>().data).toEqual({
      recorded: false,
    })
    const playback = eventLog.getAll().filter((event) => event.type.startsWith('media.playback_'))
    expect(playback.map((event) => event.type)).toEqual([
      'media.playback_started',
      'media.playback_completed',
    ])
    expect(playback[0]?.payload).toMatchObject({
      cueId: CUE_ID,
      assetId: 'media_1',
      origin: 'game_master',
      clientLatencyMs: 120,
      cueToReportMs: expect.any(Number) as number,
    })
  })

  it('requires a player token', async () => {
    const { app } = await makeApp()

    expect((await report(app, { outcome: 'started' }, 'session_mine', {})).statusCode).toBe(401)
  })

  it.each([
    ['an unknown outcome', { outcome: 'paused' }],
    ['a negative latency', { outcome: 'started', clientLatencyMs: -1 }],
    ['an unknown field', { outcome: 'started', assetId: 'media_1' }],
  ])('rejects %s with 400', async (_label, payload) => {
    const { app } = await makeApp()

    expect((await report(app, payload)).statusCode).toBe(400)
  })

  it('answers 404 for an unknown cue, an unknown session, and another player session', async () => {
    const { app } = await makeApp()
    const unknownCue = `cue_${'b'.repeat(32)}`

    const statuses = await Promise.all([
      report(app, { outcome: 'started' }, 'session_mine', playerHeaders(), unknownCue),
      report(app, { outcome: 'started' }, 'session_missing'),
      report(app, { outcome: 'started' }, 'session_other'),
      report(app, { outcome: 'started' }, 'session_other', playerHeaders('user_2')),
    ])

    expect(statuses.map((response) => response.statusCode)).toEqual([404, 404, 404, 404])
  })
})
