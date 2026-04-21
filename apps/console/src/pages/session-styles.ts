import type { CSSProperties } from 'react'
import { buttonStyle, inputStyle } from './form-styles'

export const chatHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  marginBottom: '12px',
}

export const messageListStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  minHeight: '260px',
  maxHeight: '360px',
  overflowY: 'auto',
  padding: '10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  backgroundColor: '#f9fafb',
}

export const userMessageStyle: CSSProperties = {
  alignSelf: 'flex-end',
  backgroundColor: '#e5e7eb',
  borderRadius: '8px',
  padding: '8px 10px',
  maxWidth: '85%',
  textAlign: 'right',
}

export const avatarMessageStyle: CSSProperties = {
  alignSelf: 'flex-start',
  backgroundColor: '#dbeafe',
  borderRadius: '8px',
  padding: '8px 10px',
  maxWidth: '85%',
}

export const chatComposerStyle: CSSProperties = {
  marginTop: '12px',
  display: 'flex',
  gap: '8px',
}

export const chatInputStyle: CSSProperties = {
  ...inputStyle,
  marginTop: 0,
}

export const resetButtonStyle: CSSProperties = {
  ...buttonStyle,
  marginTop: 0,
  padding: '8px 12px',
}

export const sendButtonStyle: CSSProperties = {
  ...buttonStyle,
  marginTop: 0,
  minWidth: '88px',
}
