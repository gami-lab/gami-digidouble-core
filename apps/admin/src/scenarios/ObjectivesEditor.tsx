import { useState } from 'react'
import type { JSX } from 'react'

type ObjectivesEditorProps = {
  objectives: string[]
  disabled?: boolean
  onChange: (objectives: string[]) => void
}

export function ObjectivesEditor({ objectives, disabled = false, onChange }: ObjectivesEditorProps): JSX.Element {
  const [input, setInput] = useState('')

  function handleAdd(): void {
    const trimmed = input.trim()
    if (trimmed.length === 0) return
    onChange([...objectives, trimmed])
    setInput('')
  }

  return (
    <div className="admin-form-group">
      <p className="admin-form-label">Objectives</p>
      {objectives.length > 0 ? (
        <ul className="admin-objectives-list">
          {objectives.map((objective, index) => (
            <li key={index} className="admin-objective-item">
              <span>{objective}</span>
              <button
                type="button"
                className="admin-remove-button"
                onClick={() => { onChange(objectives.filter((_, i) => i !== index)) }}
                disabled={disabled}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-muted">No objectives yet.</p>
      )}
      <div className="admin-objective-input-row">
        <input
          type="text"
          className="admin-form-input"
          placeholder="Add an objective…"
          value={input}
          onChange={(e) => { setInput(e.target.value) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          disabled={disabled}
        />
        <button
          type="button"
          className="admin-button admin-button-secondary"
          onClick={handleAdd}
          disabled={disabled}
        >
          Add
        </button>
      </div>
    </div>
  )
}
