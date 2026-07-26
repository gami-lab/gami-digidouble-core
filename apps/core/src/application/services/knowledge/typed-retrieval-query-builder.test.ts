import { describe, expect, it } from 'vitest'
import {
  buildAvatarTypedRetrievalQueries,
  buildGameMasterTypedRetrievalQueries,
  flattenTypedRetrievalQueries,
} from './typed-retrieval-query-builder.js'

/* eslint-disable max-lines-per-function */
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

  it('prioritizes exact next-turn facts from a required GM retrieval plan', () => {
    const queries = buildAvatarTypedRetrievalQueries({
      gmRetrievalQueries: ['Mona current location after staying with grandfather'],
      gmRequiredFacts: [
        "Mona's last confirmed location",
        "what Max knows about Mona's current location",
      ],
      lastUserInput: 'Where is Mona now?',
    })

    expect(queries.slice(0, 3)).toEqual([
      {
        source: 'gm_retrieval_plan',
        text: 'Mona current location after staying with grandfather',
      },
      { source: 'gm_retrieval_plan', text: "Mona's last confirmed location" },
      { source: 'gm_retrieval_plan', text: "what Max knows about Mona's current location" },
    ])
  })

  it('combines contradiction repair planning with the new related user question', () => {
    const queries = buildAvatarTypedRetrievalQueries({
      gmGuideline: 'Resolve the contradiction before progressing.',
      gmRetrievalQueries: ['Mona quarantine camp'],
      gmRequiredFacts: [
        'what actually happened to Mona',
        'what the active Avatar knows about Mona',
      ],
      lastUserInput: 'Is Mona still with her grandfather?',
    })

    expect(flattenTypedRetrievalQueries(queries)).toContain('Mona quarantine camp')
    expect(flattenTypedRetrievalQueries(queries)).toContain('Is Mona still with her grandfather?')
    expect(queries.filter((query) => query.source === 'gm_retrieval_plan')).toHaveLength(3)
  })

  it('does not invent required planning for emotional reflection', () => {
    const queries = buildAvatarTypedRetrievalQueries({
      lastUserInput: 'How do you feel about all of this?',
    })

    expect(queries).toEqual([
      { source: 'last_user_input', text: 'How do you feel about all of this?' },
    ])
    expect(queries.some((query) => query.source === 'gm_retrieval_plan')).toBe(false)
  })

  it('keeps scenario-language GM queries and required facts in the retrieval set', () => {
    const queries = buildAvatarTypedRetrievalQueries({
      gmRetrievalQueries: ['Emplacement actuel de Mona'],
      gmRequiredFacts: ['Dernier emplacement confirmé de Mona'],
      lastUserInput: 'Où est Mona maintenant ?',
    })

    expect(queries).toEqual([
      { source: 'gm_retrieval_plan', text: 'Emplacement actuel de Mona' },
      { source: 'gm_retrieval_plan', text: 'Dernier emplacement confirmé de Mona' },
      { source: 'last_user_input', text: 'Où est Mona maintenant ?' },
    ])
  })

  it('drops stale planning when the user explicitly changes topic', () => {
    const queries = buildAvatarTypedRetrievalQueries({
      gmGuideline: 'Resolve Mona location before progressing.',
      gmRetrievalQueries: ['Mona quarantine camp'],
      gmRequiredFacts: ["Mona's last confirmed location"],
      lastUserInput: 'Let us discuss the harbor instead.',
    })

    expect(queries).toEqual([
      { source: 'last_user_input', text: 'Let us discuss the harbor instead.' },
    ])
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
