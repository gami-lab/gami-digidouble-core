import { describe, expect, it } from 'vitest'
import {
  buildTypedRetrievalQueries,
  flattenTypedRetrievalQueries,
} from './typed-retrieval-query-builder.js'

describe('typed retrieval query builder', () => {
  it('builds the three retrieval queries from GM notes, last user input, and prompt memory', () => {
    const queries = buildTypedRetrievalQueries({
      gmGuideline: 'Keep the user focused on docking safety.',
      lastUserInput: 'What should I check before docking?',
      memory: {
        shortTerm: {
          exchangeCount: 2,
          recentExchanges: [
            { user: 'The tide is moving fast.', avatar: 'Use the harbor chart first.' },
          ],
        },
        working: {
          session: {
            summary: 'The user wants short, operational guidance.',
            updatedAt: '2026-06-05T10:00:00.000Z',
          },
          avatar: {
            avatarId: 'avatar_1',
            summary: 'Ava is helping with docking preparation.',
            updatedAt: '2026-06-05T10:00:00.000Z',
          },
        },
      },
    })

    expect(queries).toEqual([
      {
        source: 'gm_guideline',
        text: 'Keep the user focused on docking safety.',
      },
      {
        source: 'last_user_input',
        text: 'What should I check before docking?',
      },
      {
        source: 'working_memory',
        text: 'The user wants short, operational guidance. Ava is helping with docking preparation. User: The tide is moving fast. Avatar: Use the harbor chart first.',
      },
    ])
    expect(flattenTypedRetrievalQueries(queries)).toBe(
      'Keep the user focused on docking safety. | What should I check before docking? | The user wants short, operational guidance. Ava is helping with docking preparation. User: The tide is moving fast. Avatar: Use the harbor chart first.',
    )
  })

  it('omits missing layers and deduplicates identical query text', () => {
    const queries = buildTypedRetrievalQueries({
      gmGuideline: 'Same',
      lastUserInput: 'same',
      memory: undefined,
    })

    expect(queries).toEqual([{ source: 'gm_guideline', text: 'Same' }])
  })
})
