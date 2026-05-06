import { describe, expect, it } from 'vitest'
import { InMemorySessionMemoryRepository } from '../../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryUserMemoryFactRepository } from '../../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { DomainError } from '../../../domain/errors.js'
import { GetSessionMemoryUseCase } from './get-session-memory.use-case.js'

const SESSION = {
  sessionId: 'session_1',
  userId: 'user_1',
  scenarioId: 'scenario_1',
  status: 'active' as const,
  startedAt: '2026-05-06T09:00:00.000Z',
  lastActivityAt: '2026-05-06T10:00:00.000Z',
}

describe('GetSessionMemoryUseCase — session lookup', () => {
  it('throws NOT_FOUND when session does not exist', async () => {
    const useCase = new GetSessionMemoryUseCase(new InMemorySessionRepository([]))

    await expect(useCase.execute({ sessionId: 'nonexistent' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('throws NOT_FOUND (DomainError) specifically', async () => {
    const useCase = new GetSessionMemoryUseCase(new InMemorySessionRepository([]))

    await expect(useCase.execute({ sessionId: 'nonexistent' })).rejects.toBeInstanceOf(DomainError)
  })

  it('returns empty summary when no working memory row and no legacy memorySummary', async () => {
    const useCase = new GetSessionMemoryUseCase(
      new InMemorySessionRepository([SESSION]),
      undefined,
      new InMemorySessionMemoryRepository(),
    )

    const { memorySummary } = await useCase.execute({ sessionId: 'session_1' })

    expect(memorySummary.sessionId).toBe('session_1')
    expect(memorySummary.summary).toBe('')
    expect(memorySummary.shortTerm).toEqual({ exchangeCount: 2 })
    expect(memorySummary.longTermFactCount).toBeUndefined()
  })
})

describe('GetSessionMemoryUseCase — summary and timestamp precedence', () => {
  it('uses dedicated working memory summary over legacy session mirror', async () => {
    const sessionMemoryRepository = new InMemorySessionMemoryRepository()
    await sessionMemoryRepository.upsert({
      sessionId: 'session_1',
      summary: 'Working memory summary text',
    })

    const sessionWithLegacy = { ...SESSION, memorySummary: 'Legacy mirror — should be ignored' }

    const useCase = new GetSessionMemoryUseCase(
      new InMemorySessionRepository([sessionWithLegacy]),
      undefined,
      sessionMemoryRepository,
    )

    const { memorySummary } = await useCase.execute({ sessionId: 'session_1' })

    expect(memorySummary.summary).toBe('Working memory summary text')
  })

  it('falls back to legacy session memorySummary when no dedicated working memory row', async () => {
    const useCase = new GetSessionMemoryUseCase(
      new InMemorySessionRepository([{ ...SESSION, memorySummary: 'Legacy summary' }]),
      undefined,
      new InMemorySessionMemoryRepository(),
    )

    const { memorySummary } = await useCase.execute({ sessionId: 'session_1' })

    expect(memorySummary.summary).toBe('Legacy summary')
  })

  it('uses working memory updatedAt when a row exists', async () => {
    const sessionMemoryRepository = new InMemorySessionMemoryRepository()
    await sessionMemoryRepository.upsert({ sessionId: 'session_1', summary: 'recent summary' })
    const workingRow = await sessionMemoryRepository.findBySessionId('session_1')

    const { memorySummary } = await new GetSessionMemoryUseCase(
      new InMemorySessionRepository([SESSION]),
      undefined,
      sessionMemoryRepository,
    ).execute({ sessionId: 'session_1' })

    expect(memorySummary.updatedAt).toBe(workingRow?.updatedAt)
    expect(memorySummary.updatedAt).not.toBe(SESSION.lastActivityAt)
  })

  it('falls back to session lastActivityAt when no working memory row', async () => {
    const { memorySummary } = await new GetSessionMemoryUseCase(
      new InMemorySessionRepository([SESSION]),
      undefined,
      new InMemorySessionMemoryRepository(),
    ).execute({ sessionId: 'session_1' })

    expect(memorySummary.updatedAt).toBe(SESSION.lastActivityAt)
  })
})

describe('GetSessionMemoryUseCase — long-term fact count', () => {
  it('returns longTermFactCount when userMemoryFactRepository is provided', async () => {
    const factRepository = new InMemoryUserMemoryFactRepository()
    await factRepository.upsert({
      userId: 'user_1',
      category: 'preferences',
      key: 'language',
      value: 'TypeScript',
      confidence: 1,
    })
    await factRepository.upsert({
      userId: 'user_1',
      category: 'preferences',
      key: 'framework',
      value: 'Fastify',
      confidence: 1,
    })

    const { memorySummary } = await new GetSessionMemoryUseCase(
      new InMemorySessionRepository([SESSION]),
      factRepository,
    ).execute({ sessionId: 'session_1' })

    expect(memorySummary.longTermFactCount).toBe(2)
  })

  it('returns 0 when user has no facts', async () => {
    const { memorySummary } = await new GetSessionMemoryUseCase(
      new InMemorySessionRepository([SESSION]),
      new InMemoryUserMemoryFactRepository(),
    ).execute({ sessionId: 'session_1' })

    expect(memorySummary.longTermFactCount).toBe(0)
  })

  it('omits longTermFactCount when no userMemoryFactRepository is provided', async () => {
    const { memorySummary } = await new GetSessionMemoryUseCase(
      new InMemorySessionRepository([SESSION]),
    ).execute({ sessionId: 'session_1' })

    expect('longTermFactCount' in memorySummary).toBe(false)
  })
})
