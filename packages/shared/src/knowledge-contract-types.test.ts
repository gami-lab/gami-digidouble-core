import { describe, expect, it } from 'vitest'
import {
  isRetrievalFailureCode,
  isRetrievalOutcomeCode,
  isRetrievalQuerySource,
  RETRIEVAL_FAILURE_CODES,
  RETRIEVAL_OUTCOME_CODES,
  RETRIEVAL_QUERY_SOURCES,
} from './knowledge-contract-types.js'

describe('knowledge retrieval contracts', () => {
  it('owns one finite retrieval query-source union and runtime guard', () => {
    expect(RETRIEVAL_QUERY_SOURCES).toEqual([
      'gm_guideline',
      'gm_retrieval_query',
      'gm_required_fact',
      'last_user_input',
      'working_memory',
      'world_context',
      'direct_query',
    ])
    expect(isRetrievalQuerySource('gm_required_fact')).toBe(true)
    expect(isRetrievalQuerySource('provider_query')).toBe(false)
    expect(RETRIEVAL_OUTCOME_CODES).toEqual(['success', 'no_results', 'failed'])
    expect(isRetrievalOutcomeCode('no_results')).toBe(true)
    expect(isRetrievalOutcomeCode('partial')).toBe(false)
    expect(RETRIEVAL_FAILURE_CODES).toEqual([
      'query_embedding_failed',
      'incompatible_profile',
      'incompatible_dimension',
      'vector_search_failed',
    ])
    expect(isRetrievalFailureCode('vector_search_failed')).toBe(true)
    expect(isRetrievalFailureCode('provider_timeout')).toBe(false)
  })
})
