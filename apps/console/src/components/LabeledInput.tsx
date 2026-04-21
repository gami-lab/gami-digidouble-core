import type { CSSProperties, JSX } from 'react'

type LabeledInputProps = {
  id: string
  label: string
  value: string
  onChange: (nextValue: string) => void
  style: CSSProperties
  labelStyle: CSSProperties
  required?: boolean
  invalid?: boolean
}

export function LabeledInput(props: LabeledInputProps): JSX.Element {
  const { id, label, value, onChange, style, labelStyle, required = false, invalid = false } = props

  return (
    <>
      <label style={labelStyle} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        style={{ ...style, borderColor: invalid ? '#b91c1c' : '#d1d5db' }}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        required={required}
      />
    </>
  )
}
