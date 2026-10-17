import type { JSX } from 'react'
import type { AvatarSummary, PrepareAvatarTraitsRequest } from '@gami/shared'

export type PrepareTraitsStatus =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'success'; summary: string }
  | { kind: 'error'; message: string }

type AvatarListSectionProps = {
  avatars: AvatarSummary[]
  initialIds: Set<string>
  prepareTraitsStatus: PrepareTraitsStatus
  onAddAvatar: () => void
  onEditAvatar: (avatarId: string) => void
  onDeleteAvatar: (avatarId: string) => void
  onToggleVisibility: (avatarId: string, visible: boolean) => void
  onPrepareTraits: (request: PrepareAvatarTraitsRequest) => void
}

export function AvatarListSection({
  avatars,
  initialIds,
  prepareTraitsStatus,
  onAddAvatar,
  onEditAvatar,
  onDeleteAvatar,
  onToggleVisibility,
  onPrepareTraits,
}: AvatarListSectionProps): JSX.Element {
  const isPreparing = prepareTraitsStatus.kind === 'preparing'

  return (
    <>
      <div className="admin-section-header">
        <h3>Avatars</h3>
        <div>
          <PrepareAllTraitsButtons isPreparing={isPreparing} onPrepareTraits={onPrepareTraits} />{' '}
          <button type="button" className="admin-button admin-button-primary" onClick={onAddAvatar}>
            Add avatar
          </button>
        </div>
      </div>
      {prepareTraitsStatus.kind === 'success' ? (
        <p className="admin-success">{prepareTraitsStatus.summary}</p>
      ) : null}
      {prepareTraitsStatus.kind === 'error' ? (
        <p className="admin-error">{prepareTraitsStatus.message}</p>
      ) : null}

      {avatars.length === 0 ? (
        <p className="admin-muted">No avatars yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Model override</th>
              <th>Initially visible</th>
              <th>Traits</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {avatars.map((avatar) => (
              <AvatarRow
                key={avatar.avatarId}
                avatar={avatar}
                initiallyVisible={initialIds.has(avatar.avatarId)}
                isPreparing={isPreparing}
                onEditAvatar={onEditAvatar}
                onDeleteAvatar={onDeleteAvatar}
                onToggleVisibility={onToggleVisibility}
                onPrepareTraits={onPrepareTraits}
              />
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

type PrepareAllTraitsButtonsProps = {
  isPreparing: boolean
  onPrepareTraits: (request: PrepareAvatarTraitsRequest) => void
}

function PrepareAllTraitsButtons({
  isPreparing,
  onPrepareTraits,
}: PrepareAllTraitsButtonsProps): JSX.Element {
  if (isPreparing) {
    return (
      <button type="button" className="admin-button admin-button-secondary" disabled>
        Preparing…
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="admin-button admin-button-secondary"
        onClick={() => {
          onPrepareTraits({ scope: 'unprepared' })
        }}
      >
        Prepare missing traits
      </button>{' '}
      <button
        type="button"
        className="admin-button admin-button-secondary"
        onClick={() => {
          onPrepareTraits({ scope: 'all' })
        }}
      >
        Re-prepare all traits
      </button>
    </>
  )
}

type AvatarRowProps = {
  avatar: AvatarSummary
  initiallyVisible: boolean
  isPreparing: boolean
  onEditAvatar: (avatarId: string) => void
  onDeleteAvatar: (avatarId: string) => void
  onToggleVisibility: (avatarId: string, visible: boolean) => void
  onPrepareTraits: (request: PrepareAvatarTraitsRequest) => void
}

function AvatarRow({
  avatar,
  initiallyVisible,
  isPreparing,
  onEditAvatar,
  onDeleteAvatar,
  onToggleVisibility,
  onPrepareTraits,
}: AvatarRowProps): JSX.Element {
  return (
    <tr>
      <td>{avatar.name}</td>
      <td>
        <span className="admin-status-pill">{avatar.status}</span>
      </td>
      <td>{formatAvatarOverride(avatar.llmOverride)}</td>
      <td>
        <input
          type="checkbox"
          aria-label={`Initially visible: ${avatar.name}`}
          checked={initiallyVisible}
          onChange={(event) => {
            onToggleVisibility(avatar.avatarId, event.target.checked)
          }}
        />
      </td>
      <td>
        <span className="admin-status-pill">
          {avatar.computedTraits !== undefined ? 'prepared' : 'not prepared'}
        </span>
      </td>
      <td>
        <button
          type="button"
          className="admin-button admin-button-secondary"
          onClick={() => {
            onEditAvatar(avatar.avatarId)
          }}
        >
          Edit
        </button>{' '}
        <button
          type="button"
          className="admin-button admin-button-secondary"
          aria-label={`Prepare traits: ${avatar.name}`}
          disabled={isPreparing}
          onClick={() => {
            onPrepareTraits({ avatarId: avatar.avatarId })
          }}
        >
          Prepare traits
        </button>{' '}
        <button
          type="button"
          className="admin-button admin-button-danger"
          onClick={() => {
            onDeleteAvatar(avatar.avatarId)
          }}
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

function formatAvatarOverride(override: AvatarSummary['llmOverride']): string {
  if (override?.provider === undefined || override.model === undefined) {
    return 'Inherited'
  }

  return `${override.provider} / ${override.model}`
}
