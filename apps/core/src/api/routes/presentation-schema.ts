import { ENTRY_QUESTION_PERSONA_FIELDS, MEDIA_REF_PATTERN, PRESENTATION_LIMITS } from '@gami/shared'

const text = (maxLength: number) =>
  ({ type: 'string', minLength: 1, maxLength, pattern: '\\S' }) as const

export const mediaRefSchema = { type: 'string', pattern: MEDIA_REF_PATTERN } as const

export const scenarioPresentationBodySchema = {
  type: 'object',
  properties: {
    cover: mediaRefSchema,
    tagline: text(PRESENTATION_LIMITS.taglineMaxLength),
    introText: text(PRESENTATION_LIMITS.introTextMaxLength),
    introMedia: mediaRefSchema,
    entryQuestion: {
      type: 'object',
      required: ['prompt', 'personaField'],
      properties: {
        prompt: text(PRESENTATION_LIMITS.entryQuestionMaxLength),
        personaField: { type: 'string', enum: ENTRY_QUESTION_PERSONA_FIELDS },
      },
      additionalProperties: false,
    },
    outroText: text(PRESENTATION_LIMITS.outroTextMaxLength),
    outroMedia: mediaRefSchema,
  },
  additionalProperties: false,
} as const

export const avatarPresentationBodySchema = {
  type: 'object',
  properties: {
    portrait: mediaRefSchema,
    idleLoop: mediaRefSchema,
    hook: text(PRESENTATION_LIMITS.hookMaxLength),
    starterQuestions: {
      type: 'array',
      maxItems: PRESENTATION_LIMITS.starterQuestionsMax,
      items: text(PRESENTATION_LIMITS.starterQuestionMaxLength),
    },
  },
  additionalProperties: false,
} as const

export const scenarioPresentationUpdateBodySchema = {
  anyOf: [{ type: 'null' }, scenarioPresentationBodySchema],
} as const

export const avatarPresentationUpdateBodySchema = {
  anyOf: [{ type: 'null' }, avatarPresentationBodySchema],
} as const
