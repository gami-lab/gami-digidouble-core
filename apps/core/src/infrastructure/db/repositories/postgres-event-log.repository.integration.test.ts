import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { StoredEvent } from '../../../application/ports/IEventLogRepository.js'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'
import { PostgresEventLogRepository } from './postgres-event-log.repository.js'

function makeSkippedEvent(correlationId: string): StoredEvent {
  return {
    type: 'gm_skipped',
    severity: 'info',
    correlationId,
    payload: { triggerReason: null, turnIndex: 1, interactionCount: 1, latencyMs: 5 },
  }
}

type EventLogReadTestContext = {
  sql: Sql
  scenarioRepo: PostgresScenarioRepository
  sessionRepo: PostgresSessionRepository
  eventLogRepo: PostgresEventLogRepository
}

function defineFindBySessionOrderingTest(getContext: () => EventLogReadTestContext): void {
  it('returns events for the target session ordered newest-first', async () => {
    const { sql, scenarioRepo, sessionRepo, eventLogRepo } = getContext()
    const scenario = await scenarioRepo.create({ name: 'Event Log Read Harness' })
    const targetSession = await sessionRepo.create({
      userId: 'user-target',
      scenarioId: scenario.scenarioId,
    })
    const otherSession = await sessionRepo.create({
      userId: 'user-other',
      scenarioId: scenario.scenarioId,
    })
    const oldest = '2026-04-28T10:00:00.000Z'
    const middle = '2026-04-28T10:01:00.000Z'
    const newest = '2026-04-28T10:02:00.000Z'

    await eventLogRepo.append({
      sessionId: targetSession.sessionId,
      type: 'gm_skipped',
      severity: 'info',
      correlationId: 'corr-oldest',
      payload: { triggerReason: null, turnIndex: 1, interactionCount: 1, latencyMs: 4 },
    })
    await eventLogRepo.append({
      sessionId: otherSession.sessionId,
      type: 'gm_triggered',
      severity: 'warning',
      correlationId: 'corr-other',
      payload: { triggerReason: 'manual', turnIndex: 1, interactionCount: 1, latencyMs: 7 },
    })
    await eventLogRepo.append({
      sessionId: targetSession.sessionId,
      type: 'gm_triggered',
      severity: 'info',
      correlationId: 'corr-newest',
      requestId: 'req-newest',
      payload: { triggerReason: 'turn_threshold', turnIndex: 2, interactionCount: 2, latencyMs: 5 },
    })

    await sql`UPDATE event_log SET created_at = ${new Date(oldest)} WHERE correlation_id = 'corr-oldest'`
    await sql`UPDATE event_log SET created_at = ${new Date(middle)} WHERE correlation_id = 'corr-other'`
    await sql`UPDATE event_log SET created_at = ${new Date(newest)} WHERE correlation_id = 'corr-newest'`

    const events = await eventLogRepo.findBySessionId(targetSession.sessionId)

    expect(events).toHaveLength(2)
    expect(events.map((event) => event.correlationId)).toEqual(['corr-newest', 'corr-oldest'])
    expect(events[0]).toEqual({
      sessionId: targetSession.sessionId,
      type: 'gm_triggered',
      severity: 'info',
      correlationId: 'corr-newest',
      requestId: 'req-newest',
      payload: {
        triggerReason: 'turn_threshold',
        turnIndex: 2,
        interactionCount: 2,
        latencyMs: 5,
      },
      createdAt: newest,
    })
    expect(events[1]?.createdAt).toBe(oldest)
  })
}

function defineFindBySessionLimitTest(getContext: () => EventLogReadTestContext): void {
  it('respects the limit option', async () => {
    const { sql, scenarioRepo, sessionRepo, eventLogRepo } = getContext()
    const scenario = await scenarioRepo.create({ name: 'Event Log Limit Harness' })
    const session = await sessionRepo.create({
      userId: 'user-limit',
      scenarioId: scenario.scenarioId,
    })

    await eventLogRepo.append({
      sessionId: session.sessionId,
      type: 'gm_skipped',
      severity: 'info',
      correlationId: 'corr-limit-old',
      payload: { triggerReason: null, turnIndex: 1, interactionCount: 1, latencyMs: 2 },
    })
    await eventLogRepo.append({
      sessionId: session.sessionId,
      type: 'gm_triggered',
      severity: 'info',
      correlationId: 'corr-limit-new',
      payload: { triggerReason: 'manual', turnIndex: 2, interactionCount: 2, latencyMs: 3 },
    })

    await sql`UPDATE event_log SET created_at = ${new Date('2026-04-28T11:00:00.000Z')} WHERE correlation_id = 'corr-limit-old'`
    await sql`UPDATE event_log SET created_at = ${new Date('2026-04-28T11:01:00.000Z')} WHERE correlation_id = 'corr-limit-new'`

    const events = await eventLogRepo.findBySessionId(session.sessionId, { limit: 1 })

    expect(events).toHaveLength(1)
    expect(events[0]?.correlationId).toBe('corr-limit-new')
  })
}

function defineFindBySessionEmptyTest(getContext: () => EventLogReadTestContext): void {
  it('returns an empty array for an unknown sessionId', async () => {
    const { eventLogRepo } = getContext()
    const events = await eventLogRepo.findBySessionId(
      'session_00000000-0000-0000-0000-000000000000',
    )

    expect(events).toEqual([])
  })
}

describe.skipIf(!DB_AVAILABLE)('PostgresEventLogRepository — append and basic read', () => {
  let sql: Sql
  let eventLogRepo: PostgresEventLogRepository

  beforeAll(() => {
    sql = createTestSql()
    eventLogRepo = new PostgresEventLogRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('append inserts a row successfully', async () => {
    await expect(eventLogRepo.append(makeSkippedEvent('corr-001'))).resolves.toBeUndefined()

    const rows = await sql`SELECT COUNT(*) AS count FROM event_log`
    expect(Number(rows[0]?.['count'])).toBe(1)
  })

  it('row is retrievable via raw SQL and correlation_id matches', async () => {
    const correlationId = 'corr-test-retrieve'
    const event: StoredEvent = {
      type: 'gm_triggered',
      severity: 'info',
      correlationId,
      payload: {
        triggerReason: 'turn_threshold',
        turnIndex: 5,
        interactionCount: 5,
        latencyMs: 10,
      },
    }

    await eventLogRepo.append(event)

    const rows = await sql`SELECT * FROM event_log WHERE correlation_id = ${correlationId}`
    expect(rows).toHaveLength(1)
    expect(rows[0]?.['type']).toBe('gm_triggered')
    expect(rows[0]?.['severity']).toBe('info')
    expect(rows[0]?.['correlation_id']).toBe(correlationId)
  })

  it('sessionId = null is valid (nullable FK)', async () => {
    await expect(eventLogRepo.append(makeSkippedEvent('corr-no-session'))).resolves.toBeUndefined()

    const rows =
      await sql`SELECT session_id FROM event_log WHERE correlation_id = 'corr-no-session'`
    expect(rows).toHaveLength(1)
    expect(rows[0]?.['session_id']).toBeNull()
  })
})

describe.skipIf(!DB_AVAILABLE)('PostgresEventLogRepository — JSONB payload and session FK', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let sessionRepo: PostgresSessionRepository
  let eventLogRepo: PostgresEventLogRepository

  beforeAll(() => {
    sql = createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    sessionRepo = new PostgresSessionRepository(sql)
    eventLogRepo = new PostgresEventLogRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('payload JSONB field stores and retrieves nested objects correctly', async () => {
    const correlationId = 'corr-test-jsonb'
    type TestPayload = {
      triggerReason: string
      decision: {
        avatarId: string
        conversationMode: string
        notesInjected: boolean
        directiveCount: number
      }
      stateAfter: { progression: string; topicsCovered: string[] }
    }
    const payload: TestPayload & Record<string, unknown> = {
      triggerReason: 'topic_repeat',
      turnIndex: 3,
      interactionCount: 3,
      latencyMs: 8,
      decision: {
        avatarId: 'avatar-1',
        conversationMode: 'continue',
        notesInjected: true,
        directiveCount: 2,
      },
      stateAfter: { progression: 'advanced', topicsCovered: ['plastic', 'water'] },
    }

    await eventLogRepo.append({ type: 'gm_triggered', severity: 'info', correlationId, payload })

    const rows = await sql`SELECT payload FROM event_log WHERE correlation_id = ${correlationId}`
    expect(rows).toHaveLength(1)
    const stored = rows[0]?.['payload'] as TestPayload | undefined
    expect(stored?.triggerReason).toBe('topic_repeat')
    expect(stored?.decision).toEqual(payload.decision)
    expect(stored?.stateAfter).toEqual(payload.stateAfter)
  })

  it('sessionId with session_ prefix is stored and the row is linked to an existing session', async () => {
    const scenario = await scenarioRepo.create({ name: 'Event Log Harness' })
    const session = await sessionRepo.create({ userId: 'user-1', scenarioId: scenario.scenarioId })
    const correlationId = 'corr-with-session'

    const event: StoredEvent = {
      sessionId: session.sessionId,
      type: 'gm_triggered',
      severity: 'info',
      correlationId,
      payload: { triggerReason: 'turn_threshold', turnIndex: 5, interactionCount: 5, latencyMs: 4 },
    }

    await eventLogRepo.append(event)

    const rows = await sql`SELECT session_id FROM event_log WHERE correlation_id = ${correlationId}`
    expect(rows).toHaveLength(1)
    expect(rows[0]?.['session_id']).not.toBeNull()
  })
})

describe.skipIf(!DB_AVAILABLE)('PostgresEventLogRepository — findBySessionId', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let sessionRepo: PostgresSessionRepository
  let eventLogRepo: PostgresEventLogRepository

  beforeAll(() => {
    sql = createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    sessionRepo = new PostgresSessionRepository(sql)
    eventLogRepo = new PostgresEventLogRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  defineFindBySessionOrderingTest(() => ({ sql, scenarioRepo, sessionRepo, eventLogRepo }))
  defineFindBySessionLimitTest(() => ({ sql, scenarioRepo, sessionRepo, eventLogRepo }))
  defineFindBySessionEmptyTest(() => ({ sql, scenarioRepo, sessionRepo, eventLogRepo }))
})
