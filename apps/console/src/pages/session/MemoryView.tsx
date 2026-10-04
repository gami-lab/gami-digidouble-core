import type { JSX } from 'react'
import type { SessionMemoryLayers } from '@gami/shared'
import { formatDateTime, formatTime } from '../../debug/format'
import { Badge, Empty, KeyValues, Section, TextList } from '../../ui/ui'
import { RecentExchangesView } from './AvatarContextView'
import { MemoryRunView } from './MemoryRunView'
import { avatarName } from './SessionHeader'
import type { SessionData } from './use-session-data'

export function MemoryView({ data }: { data: SessionData }): JSX.Element {
  const updates = data.timeline.flatMap((entry) => entry.memory)

  return (
    <div className="stack">
      <p className="muted">
        Memory is layered: recent exchanges are kept verbatim, working memory is an LLM-written
        summary per conversation, and long-term memory holds episodic summaries and user facts.
      </p>
      <MemoryLayers memory={data.memory} data={data} />
      <Section
        title="Update history"
        aside={<span className="small muted">{updates.length} working-memory refreshes</span>}
      >
        {updates.length === 0 ? <Empty>No refresh recorded in the latest events.</Empty> : null}
        {[...updates].reverse().map((run) => (
          <Section
            nested
            key={run.createdAt}
            title={formatTime(run.createdAt)}
            aside={<Badge tone={run.status === 'failed' ? 'error' : 'ok'}>{run.status}</Badge>}
          >
            <MemoryRunView run={run} />
          </Section>
        ))}
      </Section>
    </div>
  )
}

function MemoryLayers({
  memory,
  data,
}: {
  memory: SessionMemoryLayers
  data: SessionData
}): JSX.Element {
  return (
    <>
      <Section
        defaultOpen
        title="Working memory (current conversation)"
        aside={
          <span className="small muted">
            {memory.working.current !== undefined
              ? formatDateTime(memory.working.current.updatedAt)
              : 'none'}
          </span>
        }
      >
        {memory.working.current === undefined ? (
          <Empty>No working memory yet: it is written after the third exchange.</Empty>
        ) : (
          <KeyValues
            items={[
              ['Avatar', avatarName(data, memory.working.current.avatarId)],
              ['Summary', <span className="prewrap">{memory.working.current.summary}</span>],
              [
                'Open threads',
                <TextList items={memory.working.current.unresolvedThreads} empty="—" />,
              ],
              [
                'Covered topics',
                <TextList items={memory.working.current.coveredTopics} empty="—" />,
              ],
              [
                'Candidate facts',
                <TextList
                  items={memory.working.current.candidateFacts.map(
                    (fact) => `${fact.category} · ${fact.key}: ${fact.value}`,
                  )}
                  empty="—"
                />,
              ],
            ]}
          />
        )}
      </Section>
      <RecentExchangesView exchanges={memory.shortTerm.recentExchanges} />
      <Section
        title="Per-avatar working summaries"
        aside={<span className="small muted">{memory.working.avatars.length}</span>}
      >
        {memory.working.avatars.length === 0 ? <Empty>None.</Empty> : null}
        {memory.working.avatars.map((avatar) => (
          <KeyValues
            key={avatar.avatarId}
            items={[
              [
                avatarName(data, avatar.avatarId),
                <span className="prewrap">{avatar.summary}</span>,
              ],
            ]}
          />
        ))}
      </Section>
      <EpisodicMemoriesView memory={memory} data={data} />
      <Section
        title="Long-term: user facts"
        aside={<span className="small muted">{memory.longTerm.facts.length}</span>}
      >
        <TextList
          items={memory.longTerm.facts.map(
            (fact) => `${fact.category} · ${fact.key}: ${fact.value}`,
          )}
          empty="No facts yet."
        />
      </Section>
    </>
  )
}

function EpisodicMemoriesView({
  memory,
  data,
}: {
  memory: SessionMemoryLayers
  data: SessionData
}): JSX.Element {
  return (
    <Section
      title="Long-term: episodic memories"
      aside={
        <span className="small muted">
          {memory.longTerm.avatars.reduce((sum, avatar) => sum + avatar.memories.length, 0)}
        </span>
      }
    >
      {memory.longTerm.avatars.length === 0 ? (
        <Empty>None yet: written when a conversation closes.</Empty>
      ) : null}
      {memory.longTerm.avatars.flatMap((avatar) =>
        avatar.memories.map((episode) => (
          <Section
            nested
            key={episode.conversationId}
            title={avatarName(data, avatar.avatarId)}
            aside={<span className="small muted">{formatDateTime(episode.createdAt)}</span>}
          >
            <p className="prewrap">{episode.summary}</p>
            <KeyValues
              items={[
                ['Discoveries', <TextList items={episode.keyDiscoveries} empty="—" />],
                ['Unresolved', <TextList items={episode.unresolvedTopics} empty="—" />],
              ]}
            />
          </Section>
        )),
      )}
    </Section>
  )
}
