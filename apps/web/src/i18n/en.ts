const en = {
  onboarding: {
    eyebrow: 'Gami DigiDouble',
    title: 'Create your local identity',
    lead: 'Your profile is stored in this browser and synced to the experience runtime.',
    name: {
      label: 'Name',
      placeholder: 'What should avatars call you?',
    },
    roleInWorld: {
      label: 'Role in world',
      placeholder: 'Detective, traveler, curator...',
    },
    avatarRelationships: {
      label: 'Avatar relationships',
      placeholder: 'Separated by comma or new line',
    },
    dialogueGuidance: {
      label: 'Dialogue guidance',
      placeholder: 'How should avatars interact with you?',
    },
    saving: 'Saving identity…',
    save: 'Save identity',
    error: {
      server: 'Unable to save identity to server: {{message}}',
      generic: 'Unable to save your identity. Please try again.',
    },
  },
  active: {
    eyebrow: 'Public Experience',
    title: 'Welcome',
    lead: 'Choose a scenario to discover avatars currently available to your session.',
    resetIdentity: 'Reset identity',
  },
  identity: {
    name: 'Name',
    roleInWorld: 'Role in world',
    relationships: 'Relationships',
    dialogueGuidance: 'Dialogue guidance',
    notSet: 'Not set',
  },
  scenarios: {
    title: 'Available scenarios',
    loading: 'Loading scenarios…',
    error: 'Unable to load scenarios.',
    empty: 'No active scenarios are available right now.',
    ariaLabel: 'Scenario list',
  },
  avatars: {
    title: 'Available avatars',
    selectScenario: 'Select a scenario to load avatar availability.',
    loading: 'Loading available avatars…',
    empty: 'No avatars are currently available. Keep this page open for unlocks.',
    ariaLabel: 'Available avatars',
  },
  chat: {
    title: 'Current chat',
    noAvatars: 'No available avatars yet. Chat unlocks will appear here.',
    pickAvatar: 'Pick one available avatar to start a single active thread.',
    avatarsAriaLabel: 'Available chat avatars',
    starting: 'Starting chat…',
    currentThread: 'Current thread',
    startChat: 'Start chat',
    selectAvatar: 'Select an avatar to open your current thread.',
    noMessages: 'No messages yet. Send the first one.',
    avatarResponding: 'Avatar is responding…',
    avatarDraft: 'Avatar response in progress',
    message: {
      label: 'Message',
      placeholder: 'Write your message...',
    },
    sending: 'Sending…',
    send: 'Send',
    endConversation: 'End conversation',
    meta: {
      sending: ' · sending…',
      streaming: ' · responding…',
      failed: ' · failed',
    },
  },
  errors: {
    sessionUnavailable: 'Session unavailable. Please select a scenario again.',
    unableToStartChat: 'Unable to start chat',
    unableToRestoreConversation: 'Unable to restore previous conversation',
    unableToSendMessage: 'Unable to send message',
    messageStreamInterrupted: 'Avatar response was interrupted. You can try again.',
    unableToEndConversation: 'Unable to end conversation',
    unableToLoadScenarios: 'Unable to load scenarios',
    unableToRefreshAvatars: 'Unable to refresh avatar availability',
    unableToLoadAvatars: 'Unable to load avatars',
  },
  language: {
    label: 'Language',
    en: 'English',
    fr: 'Français',
  },
} as const

export default en
