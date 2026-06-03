import { useEffect, useMemo, useState } from 'react'
import type { ComponentProps, JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { LocalWebIdentity } from '@gami/shared'
import { ApiError } from './api/client'
import { upsertUserPersona } from './api/users'
import { ActiveChatSection } from './chat/ActiveChatSection'
import { useActiveChatRuntime } from './chat/use-active-chat-runtime'
import { AvatarDiscoverySection } from './discovery/AvatarDiscoverySection'
import { ScenarioDiscoverySection } from './discovery/ScenarioDiscoverySection'
import { useScenarioAvatarDiscovery } from './discovery/use-scenario-avatar-discovery'
import { LanguageSwitcher } from './i18n/LanguageSwitcher'
import {
  clearLocalWebIdentity,
  createInitialIdentityFormValues,
  createLocalWebIdentity,
  type LocalIdentityFormValues,
  persistLocalWebIdentity,
  readLocalWebIdentity,
} from './identity/local-identity'
import {
  clearLocalWebRuntimeState,
  persistLocalWebRuntimeState,
  readLocalWebRuntimeState,
} from './runtime/local-runtime-state'

type AppState =
  | {
      mode: 'onboarding'
      form: LocalIdentityFormValues
      error: string | null
      isSubmitting: boolean
    }
  | {
      mode: 'active'
      identity: LocalWebIdentity
    }

type FormSubmitHandler = NonNullable<ComponentProps<'form'>['onSubmit']>

function initializeState(): AppState {
  const identity = readLocalWebIdentity()
  if (identity !== null) {
    return { mode: 'active', identity }
  }

  return {
    mode: 'onboarding',
    form: createInitialIdentityFormValues(),
    error: null,
    isSubmitting: false,
  }
}

function App(): JSX.Element {
  const { t } = useTranslation()
  const [state, setState] = useState<AppState>(initializeState)

  const handleSubmit: FormSubmitHandler = (event) => {
    void submitOnboarding(event)
  }

  async function submitOnboarding(event: Parameters<FormSubmitHandler>[0]): Promise<void> {
    event.preventDefault()

    if (state.mode !== 'onboarding' || state.isSubmitting) {
      return
    }

    try {
      const identity = createLocalWebIdentity(state.form, new Date().toISOString())
      setState((current) => {
        if (current.mode !== 'onboarding') return current
        return { ...current, error: null, isSubmitting: true }
      })

      await upsertUserPersona(identity.userId, identity.persona)
      persistLocalWebIdentity(identity)
      setState({ mode: 'active', identity })
    } catch (error) {
      setState((current) => {
        if (current.mode !== 'onboarding') return current
        return {
          ...current,
          error:
            error instanceof ApiError
              ? t('onboarding.error.server', { message: error.message })
              : t('onboarding.error.generic'),
          isSubmitting: false,
        }
      })
    }
  }

  function handleReset(): void {
    clearLocalWebIdentity()
    clearLocalWebRuntimeState()
    setState({
      mode: 'onboarding',
      form: createInitialIdentityFormValues(),
      error: null,
      isSubmitting: false,
    })
  }

  if (state.mode === 'active') {
    return <ActiveShell identity={state.identity} onReset={handleReset} />
  }

  return (
    <OnboardingShell
      form={state.form}
      error={state.error}
      isSubmitting={state.isSubmitting}
      onChange={(field, value) => {
        setState((current) => {
          if (current.mode !== 'onboarding') return current
          return {
            mode: 'onboarding',
            error: null,
            isSubmitting: false,
            form: {
              ...current.form,
              [field]: value,
            },
          }
        })
      }}
      onSubmit={handleSubmit}
    />
  )
}

type OnboardingShellProps = {
  form: LocalIdentityFormValues
  error: string | null
  isSubmitting: boolean
  onSubmit: FormSubmitHandler
  onChange: (field: keyof LocalIdentityFormValues, value: string) => void
}

function OnboardingShell({
  form,
  error,
  isSubmitting,
  onSubmit,
  onChange,
}: OnboardingShellProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <main className="page page-onboarding">
      <section className="card onboarding-card" aria-labelledby="onboarding-title">
        <div className="card-top-bar">
          <p className="eyebrow">{t('onboarding.eyebrow')}</p>
          <LanguageSwitcher />
        </div>
        <h1 id="onboarding-title">{t('onboarding.title')}</h1>
        <p className="lead">{t('onboarding.lead')}</p>

        <form className="form" onSubmit={onSubmit}>
          <div className="grid-two">
            <label className="field">
              <span>{t('onboarding.name.label')}</span>
              <input
                name="name"
                value={form.name}
                onChange={(event) => {
                  onChange('name', event.target.value)
                }}
                placeholder={t('onboarding.name.placeholder')}
              />
            </label>

            <label className="field">
              <span>{t('onboarding.roleInWorld.label')}</span>
              <input
                name="roleInWorld"
                value={form.roleInWorld}
                onChange={(event) => {
                  onChange('roleInWorld', event.target.value)
                }}
                placeholder={t('onboarding.roleInWorld.placeholder')}
              />
            </label>
          </div>

          <label className="field">
            <span>{t('onboarding.avatarRelationships.label')}</span>
            <input
              name="avatarRelationships"
              value={form.avatarRelationships}
              onChange={(event) => {
                onChange('avatarRelationships', event.target.value)
              }}
              placeholder={t('onboarding.avatarRelationships.placeholder')}
            />
          </label>

          <label className="field">
            <span>{t('onboarding.dialogueGuidance.label')}</span>
            <textarea
              name="dialogGuidance"
              value={form.dialogGuidance}
              onChange={(event) => {
                onChange('dialogGuidance', event.target.value)
              }}
              placeholder={t('onboarding.dialogueGuidance.placeholder')}
              rows={4}
            />
          </label>

          {error !== null ? <p className="error">{error}</p> : null}

          <button type="submit" className="button-primary" disabled={isSubmitting}>
            {isSubmitting ? t('onboarding.saving') : t('onboarding.save')}
          </button>
        </form>
      </section>
    </main>
  )
}

type ActiveShellProps = {
  identity: LocalWebIdentity
  onReset: () => void
}

function ActiveShell({ identity, onReset }: ActiveShellProps): JSX.Element {
  const { t } = useTranslation()
  const persistedRuntime = useMemo(() => readLocalWebRuntimeState(identity.userId), [identity.userId])
  const personaSummary = useMemo(() => buildPersonaSummary(identity), [identity])
  const discovery = useScenarioAvatarDiscovery(identity, {
    initialSelectedScenarioId: persistedRuntime?.selectedScenarioId ?? null,
  })
  const chat = useActiveChatRuntime(discovery.session, {
    initialActiveAvatarId: persistedRuntime?.activeAvatarId ?? null,
    initialConversationId: persistedRuntime?.conversationId ?? null,
  })

  useEffect(() => {
    persistLocalWebRuntimeState({
      version: 1,
      userId: identity.userId,
      selectedScenarioId: discovery.selectedScenarioId,
      sessionId: discovery.session?.sessionId ?? null,
      activeAvatarId: chat.activeAvatarId,
      conversationId: chat.conversation?.conversationId ?? null,
      updatedAt: new Date().toISOString(),
    })
  }, [
    identity.userId,
    discovery.selectedScenarioId,
    discovery.session?.sessionId,
    chat.activeAvatarId,
    chat.conversation?.conversationId,
  ])

  return (
    <main className="page page-active">
      <section className="card active-card" aria-labelledby="active-title">
        <header className="active-header">
          <div>
            <p className="eyebrow">{t('active.eyebrow')}</p>
            <h1 id="active-title">{t('active.title')}</h1>
            <p className="lead">{t('active.lead')}</p>
          </div>
          <div className="active-header-actions">
            <LanguageSwitcher />
            <button type="button" className="button-secondary" onClick={onReset}>
              {t('active.resetIdentity')}
            </button>
          </div>
        </header>

        <IdentitySummaryDetails identity={identity} personaSummary={personaSummary} />

        <ScenarioDiscoverySection
          scenarios={discovery.scenarios}
          scenarioStatus={discovery.scenarioStatus}
          scenarioError={discovery.scenarioError}
          selectedScenarioId={discovery.selectedScenarioId}
          onSelectScenario={discovery.selectScenario}
        />

        <AvatarDiscoverySection
          selectedScenarioId={discovery.selectedScenarioId}
          avatarStatus={discovery.avatarStatus}
          avatarError={discovery.avatarError}
          avatars={discovery.avatars}
        />

        <ActiveChatSection avatars={discovery.avatars} chat={chat} />
      </section>
    </main>
  )
}

type IdentitySummaryDetailsProps = {
  identity: LocalWebIdentity
  personaSummary: { relationships: string; guidance: string }
}

function IdentitySummaryDetails({
  identity,
  personaSummary,
}: IdentitySummaryDetailsProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <dl className="details details-compact">
      <div>
        <dt>{t('identity.name')}</dt>
        <dd>{identity.persona.name ?? t('identity.notSet')}</dd>
      </div>
      <div>
        <dt>{t('identity.roleInWorld')}</dt>
        <dd>{identity.persona.roleInWorld ?? t('identity.notSet')}</dd>
      </div>
      <div>
        <dt>{t('identity.relationships')}</dt>
        <dd>{personaSummary.relationships || t('identity.notSet')}</dd>
      </div>
      <div>
        <dt>{t('identity.dialogueGuidance')}</dt>
        <dd>{personaSummary.guidance || t('identity.notSet')}</dd>
      </div>
    </dl>
  )
}

function buildPersonaSummary(identity: LocalWebIdentity): {
  relationships: string
  guidance: string
} {
  const relationships =
    identity.persona.avatarRelationships !== undefined &&
    identity.persona.avatarRelationships.length > 0
      ? identity.persona.avatarRelationships.join(', ')
      : ''

  return {
    relationships,
    guidance: identity.persona.dialogGuidance ?? '',
  }
}

export default App
