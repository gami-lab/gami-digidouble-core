import { useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { UserPersona } from '@gami/shared'

type PersonaDraft = {
  name: string
  roleInWorld: string
  relationshipsText: string
  dialogGuidance: string
}

export function PersonaEditor({
  persona,
  onSave,
  buttonStyle,
}: {
  persona: UserPersona | null
  onSave: (persona: UserPersona) => Promise<void>
  buttonStyle: CSSProperties
}): JSX.Element {
  const [draft, setDraft] = useState<PersonaDraft>({
    name: persona?.name ?? '',
    roleInWorld: persona?.roleInWorld ?? '',
    relationshipsText: (persona?.avatarRelationships ?? []).join('\n'),
    dialogGuidance: persona?.dialogGuidance ?? '',
  })

  return (
    <form
      style={{ marginTop: '12px', display: 'grid', gap: '8px' }}
      onSubmit={(event) => {
        event.preventDefault()
        void onSave(buildPersonaPayload(draft))
      }}
    >
      <label>
        Name
        <input
          value={draft.name}
          onChange={(event) => {
            setDraft((prev) => ({ ...prev, name: event.target.value }))
          }}
        />
      </label>
      <label>
        Role in world
        <input
          value={draft.roleInWorld}
          onChange={(event) => {
            setDraft((prev) => ({ ...prev, roleInWorld: event.target.value }))
          }}
        />
      </label>
      <label>
        Avatar relationships (one per line)
        <textarea
          value={draft.relationshipsText}
          onChange={(event) => {
            setDraft((prev) => ({ ...prev, relationshipsText: event.target.value }))
          }}
          rows={4}
        />
      </label>
      <label>
        Dialog guidance
        <textarea
          value={draft.dialogGuidance}
          onChange={(event) => {
            setDraft((prev) => ({ ...prev, dialogGuidance: event.target.value }))
          }}
          rows={4}
        />
      </label>
      <button type="submit" style={buttonStyle}>
        Save persona
      </button>
    </form>
  )
}

export function buildPersonaPayload(draft: PersonaDraft): UserPersona {
  const relationships = draft.relationshipsText
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return {
    ...(draft.name.trim().length > 0 ? { name: draft.name.trim() } : {}),
    ...(draft.roleInWorld.trim().length > 0 ? { roleInWorld: draft.roleInWorld.trim() } : {}),
    ...(relationships.length > 0 ? { avatarRelationships: relationships } : {}),
    ...(draft.dialogGuidance.trim().length > 0
      ? { dialogGuidance: draft.dialogGuidance.trim() }
      : {}),
  }
}
