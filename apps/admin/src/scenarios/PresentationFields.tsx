import type { JSX } from 'react'
import {
  ENTRY_QUESTION_PERSONA_FIELDS,
  PRESENTATION_IMAGE_URL_PATTERN,
  PRESENTATION_LIMITS,
  type AvatarPresentation,
  type EntryQuestionPersonaField,
  type ScenarioPresentation,
} from '@gami/shared'
import { moveItem } from './presentation-form'

const PERSONA_FIELD_LABELS: Record<EntryQuestionPersonaField, string> = {
  name: 'Player name',
  roleInWorld: 'Player role in the world',
}

type TextFieldProps = {
  id: string
  label: string
  value: string | undefined
  maxLength: number
  disabled: boolean
  multiline?: boolean
  imageUrl?: boolean
  onChange: (value: string) => void
}

function TextField({
  id,
  label,
  value,
  maxLength,
  disabled,
  multiline = false,
  imageUrl = false,
  onChange,
}: TextFieldProps): JSX.Element {
  const common = {
    id,
    value: value ?? '',
    maxLength,
    disabled,
    onChange: (event: { target: { value: string } }) => {
      onChange(event.target.value)
    },
  }
  return (
    <div className="admin-form-group">
      <label htmlFor={id} className="admin-form-label">
        {label}
      </label>
      {multiline ? (
        <textarea {...common} className="admin-form-textarea" rows={3} />
      ) : (
        <input
          {...common}
          type={imageUrl ? 'url' : 'text'}
          className="admin-form-input"
          {...(imageUrl
            ? { pattern: PRESENTATION_IMAGE_URL_PATTERN, placeholder: 'https://…' }
            : {})}
        />
      )}
    </div>
  )
}

function ImagePreview({ url, alt }: { url: string | undefined; alt: string }): JSX.Element | null {
  const trimmed = url?.trim() ?? ''
  if (!new RegExp(PRESENTATION_IMAGE_URL_PATTERN).test(trimmed)) return null
  return <img className="admin-presentation-thumbnail" src={trimmed} alt={alt} loading="lazy" />
}

type ScenarioPresentationFieldsProps = {
  idPrefix: string
  value: ScenarioPresentation
  disabled: boolean
  onChange: (value: ScenarioPresentation) => void
}

export function ScenarioPresentationFields({
  idPrefix,
  value,
  disabled,
  onChange,
}: ScenarioPresentationFieldsProps): JSX.Element {
  const entryQuestion = value.entryQuestion ?? { prompt: '', personaField: 'name' as const }
  return (
    <fieldset className="admin-presentation">
      <legend>Player presentation</legend>
      <p className="admin-muted">
        Shown to visitors only; never sent to the Avatar or Game Master.
      </p>
      <TextField
        id={`${idPrefix}-cover`}
        label="Cover image URL"
        value={value.cover}
        maxLength={PRESENTATION_LIMITS.imageUrlMaxLength}
        disabled={disabled}
        imageUrl
        onChange={(cover) => {
          onChange({ ...value, cover })
        }}
      />
      <ImagePreview url={value.cover} alt="Cover preview" />
      <TextField
        id={`${idPrefix}-tagline`}
        label="Tagline"
        value={value.tagline}
        maxLength={PRESENTATION_LIMITS.taglineMaxLength}
        disabled={disabled}
        onChange={(tagline) => {
          onChange({ ...value, tagline })
        }}
      />
      <TextField
        id={`${idPrefix}-intro`}
        label="Intro text"
        value={value.introText}
        maxLength={PRESENTATION_LIMITS.introTextMaxLength}
        disabled={disabled}
        multiline
        onChange={(introText) => {
          onChange({ ...value, introText })
        }}
      />
      <TextField
        id={`${idPrefix}-entry-question`}
        label="Entry question"
        value={entryQuestion.prompt}
        maxLength={PRESENTATION_LIMITS.entryQuestionMaxLength}
        disabled={disabled}
        onChange={(prompt) => {
          onChange({ ...value, entryQuestion: { ...entryQuestion, prompt } })
        }}
      />
      <div className="admin-form-group">
        <label htmlFor={`${idPrefix}-entry-field`} className="admin-form-label">
          The answer fills
        </label>
        <select
          id={`${idPrefix}-entry-field`}
          className="admin-form-select"
          value={entryQuestion.personaField}
          disabled={disabled}
          onChange={(event) => {
            onChange({
              ...value,
              entryQuestion: {
                ...entryQuestion,
                personaField: event.target.value as EntryQuestionPersonaField,
              },
            })
          }}
        >
          {ENTRY_QUESTION_PERSONA_FIELDS.map((field) => (
            <option key={field} value={field}>
              {PERSONA_FIELD_LABELS[field]}
            </option>
          ))}
        </select>
      </div>
      <TextField
        id={`${idPrefix}-outro`}
        label="Outro text"
        value={value.outroText}
        maxLength={PRESENTATION_LIMITS.outroTextMaxLength}
        disabled={disabled}
        multiline
        onChange={(outroText) => {
          onChange({ ...value, outroText })
        }}
      />
    </fieldset>
  )
}

type AvatarPresentationFieldsProps = {
  idPrefix: string
  avatarName: string
  value: AvatarPresentation
  disabled: boolean
  onChange: (value: AvatarPresentation) => void
}

export function AvatarPresentationFields({
  idPrefix,
  avatarName,
  value,
  disabled,
  onChange,
}: AvatarPresentationFieldsProps): JSX.Element {
  return (
    <fieldset className="admin-presentation">
      <legend>Player presentation</legend>
      <TextField
        id={`${idPrefix}-portrait`}
        label="Portrait image URL"
        value={value.portrait}
        maxLength={PRESENTATION_LIMITS.imageUrlMaxLength}
        disabled={disabled}
        imageUrl
        onChange={(portrait) => {
          onChange({ ...value, portrait })
        }}
      />
      <TextField
        id={`${idPrefix}-hook`}
        label="One-line hook"
        value={value.hook}
        maxLength={PRESENTATION_LIMITS.hookMaxLength}
        disabled={disabled}
        onChange={(hook) => {
          onChange({ ...value, hook })
        }}
      />
      <StarterQuestionsEditor
        idPrefix={idPrefix}
        questions={value.starterQuestions ?? []}
        disabled={disabled}
        onChange={(starterQuestions) => {
          onChange({ ...value, starterQuestions })
        }}
      />
      <CharacterCardPreview avatarName={avatarName} value={value} />
    </fieldset>
  )
}

type StarterQuestionsEditorProps = {
  idPrefix: string
  questions: string[]
  disabled: boolean
  onChange: (questions: string[]) => void
}

function StarterQuestionsEditor({
  idPrefix,
  questions,
  disabled,
  onChange,
}: StarterQuestionsEditorProps): JSX.Element {
  const atLimit = questions.length >= PRESENTATION_LIMITS.starterQuestionsMax
  return (
    <div className="admin-form-group">
      <p className="admin-form-label">
        Starter questions (up to {PRESENTATION_LIMITS.starterQuestionsMax})
      </p>
      <ol className="admin-starter-questions">
        {questions.map((question, index) => {
          const position = String(index + 1)
          return (
            <li key={index} className="admin-starter-question">
              <input
                type="text"
                className="admin-form-input"
                aria-label={`Starter question ${position}`}
                id={`${idPrefix}-starter-${position}`}
                value={question}
                maxLength={PRESENTATION_LIMITS.starterQuestionMaxLength}
                disabled={disabled}
                onChange={(event) => {
                  onChange(questions.map((item, i) => (i === index ? event.target.value : item)))
                }}
              />
              <button
                type="button"
                className="admin-button admin-button-secondary"
                aria-label={`Move starter question ${position} up`}
                disabled={disabled || index === 0}
                onClick={() => {
                  onChange(moveItem(questions, index, -1))
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="admin-button admin-button-secondary"
                aria-label={`Move starter question ${position} down`}
                disabled={disabled || index === questions.length - 1}
                onClick={() => {
                  onChange(moveItem(questions, index, 1))
                }}
              >
                ↓
              </button>
              <button
                type="button"
                className="admin-remove-button"
                aria-label={`Remove starter question ${position}`}
                disabled={disabled}
                onClick={() => {
                  onChange(questions.filter((_, i) => i !== index))
                }}
              >
                ✕
              </button>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        className="admin-button admin-button-secondary"
        disabled={disabled || atLimit}
        onClick={() => {
          onChange([...questions, ''])
        }}
      >
        Add starter question
      </button>
    </div>
  )
}

function CharacterCardPreview({
  avatarName,
  value,
}: {
  avatarName: string
  value: AvatarPresentation
}): JSX.Element {
  const name = avatarName.trim().length > 0 ? avatarName.trim() : 'Character'
  const questions = (value.starterQuestions ?? []).filter((q) => q.trim().length > 0)
  return (
    <div className="admin-form-group">
      <p className="admin-form-label">Card preview</p>
      <article className="admin-character-card" aria-label="Character card preview">
        <ImagePreview url={value.portrait} alt={name} />
        <strong>{name}</strong>
        {value.hook !== undefined && value.hook.trim().length > 0 ? <p>{value.hook}</p> : null}
        {questions.length > 0 ? (
          <ul>
            {questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        ) : null}
      </article>
    </div>
  )
}
