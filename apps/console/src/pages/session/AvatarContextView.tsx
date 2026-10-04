import type { JSX } from 'react'
import type {
  RecordedAvatarContextSnapshot,
  SessionContextGmMemory,
  SharedShortTermMemoryExchange,
  TurnCompletedEventPayload,
  UserPersona,
} from '@gami/shared'
import { Badge, Empty, KeyValues, Section, TextList } from '../../ui/ui'

type ContextSelection = TurnCompletedEventPayload['contextSelection']

/** The structured inputs of the Avatar prompt, in prompt order; the rendered text is in Langfuse. */
// eslint-disable-next-line complexity -- render-only branching
export function AvatarContextView({
  context,
  selection,
}: {
  context: RecordedAvatarContextSnapshot
  selection: ContextSelection
}): JSX.Element {
  const { sections } = context
  const working = sections.conversationState.workingMemory
  const traitCounts = sections.avatarTraits?.sectionCounts
  const traitTotal =
    traitCounts === undefined
      ? 0
      : Object.values(traitCounts).reduce((sum, count) => sum + count, 0)

  return (
    <>
      {selection?.contextEngineSelection !== undefined ? (
        <p className="small muted">
          Token budget: {selection.contextEngineSelection.keptSegmentCount} segments kept,{' '}
          {selection.contextEngineSelection.trimmedSegmentCount} trimmed to fit. Open “Next-turn
          context” for per-segment token estimates.
        </p>
      ) : null}
      <Section
        nested
        defaultOpen={sections.directorNotes !== null}
        title="Director note (from the GM)"
        aside={
          sections.directorNotes !== null ? (
            <Badge tone="accent">present</Badge>
          ) : (
            <span className="muted small">none</span>
          )
        }
      >
        {sections.directorNotes !== null ? (
          <p className="prewrap">{sections.directorNotes}</p>
        ) : (
          <Empty>No note for this turn.</Empty>
        )}
      </Section>
      <Section
        nested
        title="Avatar identity"
        aside={
          <span className="muted small">
            {traitTotal} traits · {sections.responseRules.count} response rules
          </span>
        }
      >
        {traitCounts === undefined ? (
          <Empty>No prepared traits.</Empty>
        ) : (
          <KeyValues
            items={Object.entries(traitCounts).map(([key, count]) => [key, String(count)])}
          />
        )}
        <p className="small muted">Trait text is on the scenario’s “Avatar preparation” tab.</p>
      </Section>
      <Section
        nested
        title="User persona"
        aside={<span className="muted small">{sections.userPersona?.name ?? 'none'}</span>}
      >
        <PersonaView persona={sections.userPersona} />
      </Section>
      <RecentExchangesView exchanges={sections.conversationState.recentExchanges} />
      <MemoryInputsView
        workingSummary={
          working.conversation?.summary ?? working.avatar?.summary ?? working.session?.summary
        }
        workingReasons={working.conversation?.selectionReasons}
        unresolvedThreads={working.conversation?.unresolvedThreads}
        episodicMemories={sections.conversationState.episodicMemories}
      />
      <Section
        nested
        title="Scenario world"
        aside={
          <span className="muted small">{sections.worldContext.goals?.length ?? 0} goals</span>
        }
      >
        <KeyValues
          items={[
            [
              'Description',
              <span className="prewrap">{sections.worldContext.description ?? '—'}</span>,
            ],
            ['Goals', <TextList items={sections.worldContext.goals ?? []} empty="None" />],
          ]}
        />
      </Section>
    </>
  )
}

/** Memory inputs shared by the Avatar and GM projections. */
export function MemoryInputsView({
  workingSummary,
  workingReasons,
  unresolvedThreads,
  episodicMemories,
}: {
  workingSummary: string | undefined
  workingReasons?: string[] | undefined
  unresolvedThreads?: string[] | undefined
  episodicMemories: SessionContextGmMemory['episodicMemories']
}): JSX.Element {
  return (
    <>
      <Section
        nested
        title="Working memory"
        aside={
          <span className="muted small">{workingSummary === undefined ? 'none' : 'summary'}</span>
        }
      >
        {workingSummary === undefined ? (
          <Empty>No working memory yet.</Empty>
        ) : (
          <p className="prewrap">{workingSummary}</p>
        )}
        {unresolvedThreads !== undefined && unresolvedThreads.length > 0 ? (
          <KeyValues items={[['Open threads', <TextList items={unresolvedThreads} empty="—" />]]} />
        ) : null}
        {workingReasons !== undefined && workingReasons.length > 0 ? (
          <p className="small muted">Selected because: {workingReasons.join(', ')}</p>
        ) : null}
      </Section>
      <Section
        nested
        title="Episodic memories"
        aside={<span className="muted small">{episodicMemories.length} selected</span>}
      >
        {episodicMemories.length === 0 ? (
          <Empty>None yet: created when a conversation with this avatar closes.</Empty>
        ) : null}
        {episodicMemories.map((memory) => (
          <div key={memory.memoryId} className="small">
            <p className="prewrap">{memory.summary}</p>
            <p className="muted">
              score {memory.score.toFixed(2)} · {memory.selectionReasons.join(', ')}
            </p>
          </div>
        ))}
      </Section>
    </>
  )
}

function PersonaView({ persona }: { persona: UserPersona | null }): JSX.Element {
  if (persona === null) return <Empty>No persona.</Empty>
  return (
    <KeyValues
      items={[
        ['Name', persona.name ?? '—'],
        ['Role', persona.roleInWorld ?? '—'],
        ['Relationships', <TextList items={persona.avatarRelationships ?? []} empty="—" />],
        ['Dialogue guidance', persona.dialogGuidance ?? '—'],
      ]}
    />
  )
}

export function RecentExchangesView({
  exchanges,
}: {
  exchanges: SharedShortTermMemoryExchange[]
}): JSX.Element {
  return (
    <Section
      nested
      title="Recent exchanges"
      aside={<span className="muted small">{exchanges.length} verbatim</span>}
    >
      {exchanges.length === 0 ? <Empty>None (first turn).</Empty> : null}
      {exchanges.map((exchange, index) => (
        <div key={`${String(index)}-${exchange.user}`} className="small">
          <p className="prewrap">
            <strong>user:</strong> {exchange.user}
          </p>
          <p className="prewrap muted">
            <strong>avatar:</strong> {exchange.avatar}
          </p>
        </div>
      ))}
    </Section>
  )
}
