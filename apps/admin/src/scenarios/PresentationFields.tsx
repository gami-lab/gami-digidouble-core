import type { JSX } from 'react'
import {
  AVATAR_MEDIA_TRIGGER_SLOTS,
  AVATAR_PRESENTATION_MEDIA_SLOTS,
  ENTRY_QUESTION_PERSONA_FIELDS,
  PRESENTATION_LIMITS,
  SCENARIO_PRESENTATION_MEDIA_SLOTS,
  type AvatarMediaTriggers,
  type MediaKind,
  type MediaRef,
  type AvatarPresentation,
  type EntryQuestionPersonaField,
  type ScenarioPresentation,
} from '@gami/shared'
import { MediaPicker } from '../media/MediaPicker'
import { useMediaAssets, type MediaAssetsState } from '../media/use-media-assets'
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
  onChange: (value: string) => void
}

function TextField({
  id,
  label,
  value,
  maxLength,
  disabled,
  multiline = false,
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
        <input {...common} type="text" className="admin-form-input" />
      )}
    </div>
  )
}

type MediaSlotsProps = {
  idPrefix: string
  slots: Record<string, readonly MediaKind[]>
  labels: Record<string, string>
  values: Readonly<Record<string, unknown>>
  media: MediaAssetsState
  disabled: boolean
  onChange: (slot: string, value: MediaRef | undefined) => void
}

function MediaSlots({
  idPrefix,
  slots,
  labels,
  values,
  media,
  disabled,
  onChange,
}: MediaSlotsProps): JSX.Element {
  return (
    <>
      {media.error !== null ? <p className="admin-error">{media.error}</p> : null}
      {Object.entries(slots).map(([slot, kinds]) => (
        <MediaPicker
          key={slot}
          id={`${idPrefix}-${slot}`}
          label={labels[slot] ?? slot}
          value={readRef(values[slot])}
          assets={media.assets}
          kinds={kinds}
          disabled={disabled}
          onChange={(next) => {
            onChange(slot, next)
          }}
        />
      ))}
    </>
  )
}

function readRef(value: unknown): MediaRef | undefined {
  return typeof value === 'string' ? value : undefined
}

const SCENARIO_MEDIA_LABELS = { cover: 'Cover', introMedia: 'Intro media', outroMedia: 'Outro media' }
const AVATAR_MEDIA_LABELS = { portrait: 'Portrait', idleLoop: 'Idle loop' }
const TRIGGER_LABELS = { onUnlock: 'When unlocked', onSwitchTo: 'When the visitor switches to' }

type ScenarioPresentationFieldsProps = {
  idPrefix: string
  value: ScenarioPresentation
  /** Absent while the scenario is being created: it has no media library yet. */
  scenarioId?: string
  disabled: boolean
  onChange: (value: ScenarioPresentation) => void
}

export function ScenarioPresentationFields({
  idPrefix,
  value,
  scenarioId,
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
      {scenarioId === undefined ? (
        <p className="admin-muted">
          Save the scenario first, then add media in its library to assign it here.
        </p>
      ) : (
        <ScenarioMediaSlots
          idPrefix={idPrefix}
          scenarioId={scenarioId}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      )}
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

function ScenarioMediaSlots({
  idPrefix,
  scenarioId,
  value,
  disabled,
  onChange,
}: {
  idPrefix: string
  scenarioId: string
  value: ScenarioPresentation
  disabled: boolean
  onChange: (value: ScenarioPresentation) => void
}): JSX.Element {
  const media = useMediaAssets(scenarioId)
  return (
    <MediaSlots
      idPrefix={idPrefix}
      slots={SCENARIO_PRESENTATION_MEDIA_SLOTS}
      labels={SCENARIO_MEDIA_LABELS}
      values={value}
      media={media}
      disabled={disabled}
      onChange={(slot, ref) => {
        onChange({ ...value, [slot]: ref })
      }}
    />
  )
}

type AvatarPresentationFieldsProps = {
  idPrefix: string
  avatarName: string
  value: AvatarPresentation
  media: MediaAssetsState
  disabled: boolean
  onChange: (value: AvatarPresentation) => void
}

export function AvatarPresentationFields({
  idPrefix,
  avatarName,
  value,
  media,
  disabled,
  onChange,
}: AvatarPresentationFieldsProps): JSX.Element {
  return (
    <fieldset className="admin-presentation">
      <legend>Player presentation</legend>
      <MediaSlots
        idPrefix={idPrefix}
        slots={AVATAR_PRESENTATION_MEDIA_SLOTS}
        labels={AVATAR_MEDIA_LABELS}
        values={value}
        media={media}
        disabled={disabled}
        onChange={(slot, ref) => {
          onChange({ ...value, [slot]: ref })
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

type AvatarMediaTriggerFieldsProps = {
  idPrefix: string
  value: AvatarMediaTriggers
  media: MediaAssetsState
  disabled: boolean
  onChange: (value: AvatarMediaTriggers) => void
}

/** Story-event media Core cues to the player; separate from presentation by contract. */
export function AvatarMediaTriggerFields({
  idPrefix,
  value,
  media,
  disabled,
  onChange,
}: AvatarMediaTriggerFieldsProps): JSX.Element {
  return (
    <fieldset className="admin-presentation">
      <legend>Media triggers</legend>
      <p className="admin-muted">
        Played once to the visitor when this character is unlocked or chosen.
      </p>
      <MediaSlots
        idPrefix={`${idPrefix}-trigger`}
        slots={AVATAR_MEDIA_TRIGGER_SLOTS}
        labels={TRIGGER_LABELS}
        values={value}
        media={media}
        disabled={disabled}
        onChange={(slot, ref) => {
          onChange({ ...value, [slot]: ref })
        }}
      />
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
