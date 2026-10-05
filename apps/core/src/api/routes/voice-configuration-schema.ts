import { TEXT_TO_SPEECH_PROVIDER_NAMES, VOICE_ID_MAX_LENGTH } from '@gami/shared'

export const voiceConfigurationBodySchema = {
  type: 'object',
  required: ['provider'],
  properties: {
    provider: { type: 'string', enum: TEXT_TO_SPEECH_PROVIDER_NAMES },
    voiceId: { type: 'string', minLength: 1, maxLength: VOICE_ID_MAX_LENGTH },
  },
  patternProperties: { '^(?!provider$|voiceId$).*': { not: {} } },
  additionalProperties: false,
} as const

export const voiceConfigurationUpdateBodySchema = {
  anyOf: [{ type: 'null' }, voiceConfigurationBodySchema],
} as const
