import { avatarOptionsSchema } from './avatar-options.schema.js'

export const startSessionBodySchema = {
  type: 'object',
  required: ['userId', 'scenarioId'],
  properties: {
    userId: { type: 'string', minLength: 1 },
    scenarioId: { type: 'string', minLength: 1 },
    avatarOptions: avatarOptionsSchema,
  },
  additionalProperties: false,
} as const
