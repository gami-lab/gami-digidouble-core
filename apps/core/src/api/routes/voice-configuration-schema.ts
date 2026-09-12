export const voiceConfigurationBodySchema = {
  type: 'object',
  required: ['voiceKey'],
  properties: {
    voiceKey: { type: 'string', minLength: 1 },
    language: { type: 'string', minLength: 1 },
  },
  patternProperties: { '^(?!voiceKey$|language$).*': { not: {} } },
  additionalProperties: false,
} as const

export const voiceConfigurationUpdateBodySchema = {
  anyOf: [{ type: 'null' }, voiceConfigurationBodySchema],
} as const
