import { avatarOptionsSchema } from './avatar-options.schema.js'
import { MODEL_SELECTION_PROVIDER_NAMES } from '@gami/shared'

const modelOverrideSchema = {
  type: 'object',
  properties: {
    provider: { type: 'string', enum: MODEL_SELECTION_PROVIDER_NAMES },
    model: { type: 'string', minLength: 1, maxLength: 200 },
    serviceTier: { type: 'string', enum: ['fast'] },
  },
  minProperties: 1,
  additionalProperties: false,
} as const

export const startSessionBodySchema = {
  type: 'object',
  required: ['userId', 'scenarioId'],
  properties: {
    userId: { type: 'string', minLength: 1 },
    scenarioId: { type: 'string', minLength: 1 },
    model: modelOverrideSchema,
    avatarOptions: avatarOptionsSchema,
  },
  additionalProperties: false,
} as const
