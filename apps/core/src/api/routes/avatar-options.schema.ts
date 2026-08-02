import { AVATAR_RETRIEVAL_MAX_CHUNKS } from '@gami/shared'

export const avatarOptionsSchema = {
  type: 'object',
  properties: {
    retrieval: {
      type: 'object',
      properties: {
        maxChunks: { type: 'integer', minimum: 1, maximum: AVATAR_RETRIEVAL_MAX_CHUNKS },
        minimumChunksBySource: {
          type: 'object',
          properties: {
            gm_required_fact: {
              type: 'integer',
              minimum: 0,
              maximum: AVATAR_RETRIEVAL_MAX_CHUNKS,
            },
            gm_retrieval_query: {
              type: 'integer',
              minimum: 0,
              maximum: AVATAR_RETRIEVAL_MAX_CHUNKS,
            },
            last_user_input: {
              type: 'integer',
              minimum: 0,
              maximum: AVATAR_RETRIEVAL_MAX_CHUNKS,
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const
