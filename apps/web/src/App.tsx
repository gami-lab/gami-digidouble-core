import { useMemo, useState } from 'react'
import type { ComponentProps, JSX } from 'react'
import type { LocalWebIdentity } from '@gami/shared'
import {
  clearLocalWebIdentity,
  createInitialIdentityFormValues,
  createLocalWebIdentity,
  type LocalIdentityFormValues,
  persistLocalWebIdentity,
  readLocalWebIdentity,
} from './identity/local-identity'

type AppState =
  | {
      mode: 'onboarding'
      form: LocalIdentityFormValues
      error: string | null
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
  }
}

function App(): JSX.Element {
  const [state, setState] = useState<AppState>(initializeState)

  const handleSubmit: FormSubmitHandler = (event) => {
    event.preventDefault()

    if (state.mode !== 'onboarding') {
      return
    }

    try {
      const identity = createLocalWebIdentity(state.form, new Date().toISOString())
      persistLocalWebIdentity(identity)
      setState({ mode: 'active', identity })
    } catch {
      setState((current) => {
        if (current.mode !== 'onboarding') return current
        return {
          ...current,
          error: 'Please provide a valid user ID to continue.',
        }
      })
    }
  }

  function handleReset(): void {
    clearLocalWebIdentity()
    setState({
      mode: 'onboarding',
      form: createInitialIdentityFormValues(),
      error: null,
    })
  }

  if (state.mode === 'active') {
    return <ActiveShell identity={state.identity} onReset={handleReset} />
  }

  return (
    <OnboardingShell
      form={state.form}
      error={state.error}
      onChange={(field, value) => {
        setState((current) => {
          if (current.mode !== 'onboarding') return current
          return {
            mode: 'onboarding',
            error: null,
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
  onSubmit: FormSubmitHandler
  onChange: (field: keyof LocalIdentityFormValues, value: string) => void
}

function OnboardingShell({ form, error, onSubmit, onChange }: OnboardingShellProps): JSX.Element {
  return (
    <main className="page page-onboarding">
      <section className="card onboarding-card" aria-labelledby="onboarding-title">
        <p className="eyebrow">Gami DigiDouble</p>
        <h1 id="onboarding-title">Create your local identity</h1>
        <p className="lead">
          Your profile is stored only in this browser. You can reset it anytime.
        </p>

        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>User ID</span>
            <input
              name="userId"
              value={form.userId}
              onChange={(event) => {
                onChange('userId', event.target.value)
              }}
              autoComplete="off"
              placeholder="e.g. player.nora"
              required
            />
          </label>

          <div className="grid-two">
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                value={form.name}
                onChange={(event) => {
                  onChange('name', event.target.value)
                }}
                placeholder="What should avatars call you?"
              />
            </label>

            <label className="field">
              <span>Role in world</span>
              <input
                name="roleInWorld"
                value={form.roleInWorld}
                onChange={(event) => {
                  onChange('roleInWorld', event.target.value)
                }}
                placeholder="Detective, traveler, curator..."
              />
            </label>
          </div>

          <label className="field">
            <span>Avatar relationships</span>
            <input
              name="avatarRelationships"
              value={form.avatarRelationships}
              onChange={(event) => {
                onChange('avatarRelationships', event.target.value)
              }}
              placeholder="Separated by comma or new line"
            />
          </label>

          <label className="field">
            <span>Dialogue guidance</span>
            <textarea
              name="dialogGuidance"
              value={form.dialogGuidance}
              onChange={(event) => {
                onChange('dialogGuidance', event.target.value)
              }}
              placeholder="How should avatars interact with you?"
              rows={4}
            />
          </label>

          {error !== null ? <p className="error">{error}</p> : null}

          <button type="submit" className="button-primary">
            Save identity
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
  const personaSummary = useMemo(() => buildPersonaSummary(identity), [identity])

  return (
    <main className="page page-active">
      <section className="card active-card" aria-labelledby="active-title">
        <header className="active-header">
          <div>
            <p className="eyebrow">Ready</p>
            <h1 id="active-title">Welcome, {identity.userId}</h1>
            <p className="lead">Identity loaded from your browser. Public runtime flows come next.</p>
          </div>
          <button type="button" className="button-secondary" onClick={onReset}>
            Reset identity
          </button>
        </header>

        <dl className="details">
          <div>
            <dt>Name</dt>
            <dd>{identity.persona.name ?? 'Not set'}</dd>
          </div>
          <div>
            <dt>Role in world</dt>
            <dd>{identity.persona.roleInWorld ?? 'Not set'}</dd>
          </div>
          <div>
            <dt>Relationships</dt>
            <dd>{personaSummary.relationships}</dd>
          </div>
          <div>
            <dt>Dialogue guidance</dt>
            <dd>{personaSummary.guidance}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{new Date(identity.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>
    </main>
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
      : 'Not set'

  return {
    relationships,
    guidance: identity.persona.dialogGuidance ?? 'Not set',
  }
}

export default App
