import type { Dispatch, JSX, SetStateAction, SyntheticEvent } from 'react'
import type { AvailableAvatarSummary, ConversationSummary, Message, ScenarioSummary } from '../api'
import { AvatarAvailabilityPanel } from './AvatarAvailabilityPanel'
import { ConversationTimeline } from './ConversationTimeline'
import { GuidedShortcuts, AI_GUIDED_DISCOVERY_SHORTCUTS } from './GuidedShortcuts'
import { ScenarioChatPanel } from './ScenarioChatPanel'
import { ScenarioSessionLauncher } from './ScenarioSessionLauncher'
import { StateInspector } from './StateInspector'
import { errorStyle, sectionStyle } from '../pages/form-styles'
import type { ScenarioTestState } from '../pages/scenario-test-state'
import type { AvatarAvailabilityEntry } from '../pages/scenario-test-state'

type ScenarioTestLayoutProps = {
  scenario: ScenarioSummary
  state: ScenarioTestState
  userId: string
  draftMessage: string
  isStartingSession: boolean
  isSwitching: boolean
  isSending: boolean
  isLoadingHistory: boolean
  availabilityEntries: AvatarAvailabilityEntry[]
  timelineEntries: Array<{
    conversation: ConversationSummary
    avatarName: string
    episodeIndex: number
  }>
  selectedConversation: ConversationSummary | null
  selectedMessages: Message[]
  availableAvatarsForInspector: AvailableAvatarSummary[]
  allAvatarsById: Map<string, AvailableAvatarSummary>
  onUserIdChange: Dispatch<SetStateAction<string>>
  onStartSession: () => void
  onSwitchAvatar: (avatarId: string) => void
  onSendMessage: (message: string) => void
  onSendDraft: (event: SyntheticEvent<HTMLFormElement>) => void
  onDraftChange: Dispatch<SetStateAction<string>>
  onOpenConversation: (conversation: ConversationSummary) => void
  onReturnToGuide: () => void
  onTestLockedAccess: () => void
}

// eslint-disable-next-line max-lines-per-function
export function ScenarioTestLayout({
  scenario,
  state,
  userId,
  draftMessage,
  isStartingSession,
  isSwitching,
  isSending,
  isLoadingHistory,
  availabilityEntries,
  timelineEntries,
  selectedConversation,
  selectedMessages,
  availableAvatarsForInspector,
  allAvatarsById,
  onUserIdChange,
  onStartSession,
  onSwitchAvatar,
  onSendMessage,
  onSendDraft,
  onDraftChange,
  onOpenConversation,
  onReturnToGuide,
  onTestLockedAccess,
}: ScenarioTestLayoutProps): JSX.Element {
  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>AI Guided Discovery - Scenario Test Bench</h2>
      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Scenario: <strong>{scenario.name}</strong>
      </p>
      <ScenarioSessionLauncher
        userId={userId}
        session={state.session}
        isStarting={isStartingSession}
        onUserIdChange={onUserIdChange}
        onStart={onStartSession}
      />
      {state.session !== null ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginTop: '16px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Avatars</h3>
                <AvatarAvailabilityPanel
                  entries={availabilityEntries}
                  isSwitching={isSwitching}
                  onSwitch={onSwitchAvatar}
                />
              </div>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Conversation Timeline</h3>
                <ConversationTimeline
                  entries={timelineEntries}
                  selectedConversationId={state.selectedConversationId}
                  isLoading={isLoadingHistory}
                  onSelectConversation={onOpenConversation}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '8px' }}>
                  {selectedConversation !== null
                    ? `Chat - ${allAvatarsById.get(selectedConversation.avatarId)?.name ?? 'Avatar'}`
                    : 'Chat'}
                </h3>
                <ScenarioChatPanel
                  conversation={selectedConversation}
                  messages={selectedMessages}
                  draftMessage={draftMessage}
                  isSending={isSending}
                  isLoadingHistory={isLoadingHistory}
                  onSendDraft={onSendDraft}
                  onDraftChange={onDraftChange}
                />
              </div>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Session Inspector</h3>
                <StateInspector
                  session={state.session}
                  availableAvatars={availableAvatarsForInspector}
                  allAvatarsById={allAvatarsById}
                  unlockEvents={state.unlockEvents}
                />
              </div>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Quick Test Actions</h3>
            <GuidedShortcuts
              shortcuts={AI_GUIDED_DISCOVERY_SHORTCUTS}
              isSending={isSending || isSwitching}
              hasActiveConversation={state.selectedConversationId !== null}
              onSendShortcut={onSendMessage}
              onReturnToGuide={onReturnToGuide}
              onTestLockedAccess={onTestLockedAccess}
            />
          </div>
        </>
      ) : null}
      {state.lastError !== null ? <p style={errorStyle}>{state.lastError}</p> : null}
    </section>
  )
}
