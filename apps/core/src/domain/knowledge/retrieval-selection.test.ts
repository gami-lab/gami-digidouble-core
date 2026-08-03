import { describe, expect, it } from 'vitest'

import type { RetrievedKnowledgeItem } from './knowledge.types.js'
import { selectBalancedRetrievedItems } from './retrieval-selection.js'

function item(
  chunkId: string,
  source: NonNullable<RetrievedKnowledgeItem['matchedQuery']>['source'],
): RetrievedKnowledgeItem {
  return {
    sourceId: `source_${chunkId}`,
    chunkId,
    knowledgeType: 'world',
    content: chunkId,
    score: 1,
    matchedQuery: { source, text: source },
  }
}

describe('selectBalancedRetrievedItems', () => {
  it('keeps one chunk from each planned source by default', () => {
    const selected = selectBalancedRetrievedItems(
      [
        item('fact-1', 'gm_required_fact'),
        item('fact-2', 'gm_required_fact'),
        item('query-1', 'gm_retrieval_query'),
        item('user-1', 'last_user_input'),
      ],
      5,
    )

    expect(selected.map((entry) => entry.chunkId)).toEqual([
      'user-1',
      'query-1',
      'fact-1',
      'fact-2',
    ])
  })

  it('defaults to three chunks from the latest user input when available', () => {
    const selected = selectBalancedRetrievedItems(
      [
        item('fact-1', 'gm_required_fact'),
        item('query-1', 'gm_retrieval_query'),
        item('user-1', 'last_user_input'),
        item('user-2', 'last_user_input'),
        item('user-3', 'last_user_input'),
      ],
      7,
    )

    expect(
      selected.filter((entry) => entry.matchedQuery?.source === 'last_user_input'),
    ).toHaveLength(3)
  })

  it('honors configured source minimums within the total chunk budget', () => {
    const selected = selectBalancedRetrievedItems(
      [
        item('fact-1', 'gm_required_fact'),
        item('fact-2', 'gm_required_fact'),
        item('query-1', 'gm_retrieval_query'),
        item('query-2', 'gm_retrieval_query'),
        item('user-1', 'last_user_input'),
      ],
      4,
      {
        maxChunks: 4,
        minimumChunksBySource: {
          gm_required_fact: 2,
          gm_retrieval_query: 1,
          last_user_input: 1,
        },
      },
    )

    expect(selected.map((entry) => entry.chunkId)).toEqual([
      'user-1',
      'query-1',
      'fact-1',
      'fact-2',
    ])
  })
})
