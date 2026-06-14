import { describe, expect, it } from 'vitest'
import {
  buildAvatarTypedRetrievalQueries,
  buildGameMasterTypedRetrievalQueries,
  flattenTypedRetrievalQueries,
} from './typed-retrieval-query-builder.js'

describe('typed retrieval query builder', () => {
  it('builds avatar retrieval queries from GM notes, user input, and prompt memory', () => {
    const queries = buildAvatarTypedRetrievalQueries({
      gmGuideline: 'Keep the user focused on docking safety.',
      lastUserInput: 'What should I check before docking?',
      workingMemorySummary: 'The user wants short, operational guidance.',
      recentExchanges: [
        { user: 'The tide is moving fast.', avatar: 'Use the harbor chart first.' },
        { user: 'The dock is crowded.', avatar: 'Approach slowly and signal early.' },
      ],
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
        text: 'The user wants short, operational guidance. User: The tide is moving fast. Avatar: Use the harbor chart first. User: The dock is crowded. Avatar: Approach slowly and signal early.',
      },
    ])
    expect(flattenTypedRetrievalQueries(queries)).toBe(
      'Keep the user focused on docking safety. | What should I check before docking? | The user wants short, operational guidance. User: The tide is moving fast. Avatar: Use the harbor chart first. User: The dock is crowded. Avatar: Approach slowly and signal early.',
    )
  })

  it('omits missing layers and deduplicates identical query text', () => {
    const queries = buildAvatarTypedRetrievalQueries({
      gmGuideline: 'Same',
      lastUserInput: 'same',
      workingMemorySummary: undefined,
      recentExchanges: undefined,
    })

    expect(queries).toEqual([{ source: 'gm_guideline', text: 'Same' }])
  })

  it('builds GM retrieval queries from world context and current exchanges', () => {
    const queries = buildGameMasterTypedRetrievalQueries({
      worldContext: 'The harbor closes at dusk during storm warnings.',
      workingMemorySummary: 'The user is still navigating docking rules.',
      recentExchanges: [{ user: 'Can I dock now?', avatar: 'Only before dusk.' }],
    })

    expect(queries).toEqual([
      {
        source: 'world_context',
        text: 'The harbor closes at dusk during storm warnings.',
      },
      {
        source: 'working_memory',
        text: 'The user is still navigating docking rules. User: Can I dock now? Avatar: Only before dusk.',
      },
    ])
  })
})
