import {
  ENTRY_QUESTION_PERSONA_FIELDS,
  PRESENTATION_IMAGE_URL_PATTERN,
  PRESENTATION_LIMITS,
} from '@gami/shared'

const text = (maxLength: number) =>
  ({ type: 'string', minLength: 1, maxLength, pattern: '\\S' }) as const

const imageUrl = {
  type: 'string',
  maxLength: PRESENTATION_LIMITS.imageUrlMaxLength,
  pattern: PRESENTATION_IMAGE_URL_PATTERN,
} as const

export const scenarioPresentationBodySchema = {
  type: 'object',
  properties: {
    cover: imageUrl,
    tagline: text(PRESENTATION_LIMITS.taglineMaxLength),
    introText: text(PRESENTATION_LIMITS.introTextMaxLength),
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
  },
  additionalProperties: false,
} as const

export const avatarPresentationBodySchema = {
  type: 'object',
  properties: {
    portrait: imageUrl,
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
