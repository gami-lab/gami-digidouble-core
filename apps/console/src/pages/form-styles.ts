import type { CSSProperties } from 'react'

export const sectionStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '12px',
  padding: '20px',
  backgroundColor: '#ffffff',
}

export const labelStyle: CSSProperties = {
  display: 'block',
  marginTop: '12px',
  marginBottom: '6px',
  fontWeight: 600,
}

export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
}

export const successStyle: CSSProperties = {
  marginTop: '12px',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #16a34a',
  color: '#166534',
  backgroundColor: '#ecfdf5',
}

export const errorStyle: CSSProperties = {
  marginTop: '8px',
  color: '#b91c1c',
  fontSize: '14px',
}

export const buttonStyle: CSSProperties = {
  marginTop: '16px',
  padding: '10px 14px',
  border: '1px solid #1f2937',
  borderRadius: '8px',
  backgroundColor: '#1f2937',
  color: '#ffffff',
  cursor: 'pointer',
}
