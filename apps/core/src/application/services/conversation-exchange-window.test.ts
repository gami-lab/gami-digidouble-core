import { describe, expect, it } from 'vitest'
import {
  selectExchangeMessageWindow,
  selectExchangeWindow,
  selectRecentExchanges,
} from './conversation-exchange-window.js'

const messages = [
  {
    role: 'avatar' as const,
    content: 'orphaned answer',
    createdAt: '2026-06-01T10:00:00.000Z',
  },
  {
    role: 'user' as const,
    content: '',
    createdAt: '2026-06-01T10:00:01.000Z',
  },
  {
    role: 'system' as const,
    content: 'system note',
    createdAt: '2026-06-01T10:00:01.500Z',
  },
  {
    role: 'avatar' as const,
    content: 'empty-turn answer',
    createdAt: '2026-06-01T10:00:03.000Z',
  },
  {
    role: 'user' as const,
    content: 'pending question',
    createdAt: '2026-06-01T10:00:04.000Z',
  },
]

describe('conversation exchange window', () => {
  it('sorts messages, pairs complete exchanges, and omits incomplete turns', () => {
    expect(selectExchangeWindow(messages)).toEqual([{ user: '', avatar: 'empty-turn answer' }])
    expect(selectExchangeMessageWindow(messages)).toEqual([
      { role: 'user', content: '' },
      { role: 'avatar', content: 'empty-turn answer' },
    ])
  })

  it('selects exchanges after working-memory refresh and falls back to a bounded tail', () => {
    const history = [
      ...messages.filter((message) => message.content !== 'pending question'),
      {
        role: 'user' as const,
        content: 'new question',
        createdAt: '2026-06-01T10:01:00.000Z',
      },
      {
        role: 'avatar' as const,
        content: 'new answer',
        createdAt: '2026-06-01T10:01:01.000Z',
      },
    ]

    expect(selectExchangeWindow(history, '2026-06-01T10:00:30.000Z')).toEqual([
      { user: 'new question', avatar: 'new answer' },
    ])
    expect(selectExchangeWindow(history, '2026-06-01T10:02:00.000Z', 1)).toEqual([
      { user: 'new question', avatar: 'new answer' },
    ])
    expect(selectExchangeWindow(history, '2026-06-01T10:02:00.000Z', 0)).toEqual([])
  })

  it('applies a trailing exchange cap without changing pairing semantics', () => {
    const history = [1, 2, 3].flatMap((index) => [
      {
        role: 'user' as const,
        content: `question-${String(index)}`,
        createdAt: `2026-06-01T10:0${String(index)}:00.000Z`,
      },
      {
        role: 'avatar' as const,
        content: `answer-${String(index)}`,
        createdAt: `2026-06-01T10:0${String(index)}:01.000Z`,
      },
    ])

    expect(selectRecentExchanges(history, 2)).toEqual([
      { user: 'question-2', avatar: 'answer-2' },
      { user: 'question-3', avatar: 'answer-3' },
    ])
  })
})
