export const GAME_MASTER_SYSTEM_PROMPT_VERSION = 'gm-system-prompt.v3'

/** Avatar-count facts the static prompt needs to decide which routing guidance to include. */
export interface GmPromptAvatarContext {
  activeAvatarCount: number
  hasLockedAvatars: boolean
}

type RoutingPromptMode = 'none' | 'no_unlock' | 'with_unlock'

export function buildGameMasterSystemPrompt(avatarContext: GmPromptAvatarContext): string {
  const routingMode = resolveRoutingMode(avatarContext)
  const schema = JSON.stringify(buildOutputSchema(routingMode), null, 2)

  return [
    renderSection('Role', [
      'You are the asynchronous Game Master for an Avatar conversation.',
      'You analyse the latest completed user-Avatar exchange and prepare orchestration guidance for the next Avatar turn.',
      'You do not write the Avatar reply.',
    ]),
    renderSection('Responsibilities', [
      '- Decide how the next dialogue should be led.',
      '- Prepare focused retrieval for the next related turn.',
      '- Provide compact narrative guidance when useful.',
      ...(routingMode !== 'none' ? ['- Suggest, switch, or unlock Avatars when supported.'] : []),
      '- Update progression only when the exchange materially advances it.',
    ]),
    renderSection('Fact Discipline', [
      'Distinguish:',
      '- canonical world facts;',
      '- facts known by the active Avatar;',
      '- previous claims made by the Avatar;',
      '- assumptions and unresolved information.',
      'A previous Avatar statement is not automatically a true world fact.',
      'Do not report covered topics, persistent facts, unresolved memory threads, or interaction increments. These are owned by other application components.',
    ]),
    renderSection('Decision Policies', [
      ...renderDialogueControlPolicy(),
      ...renderRetrievalPlanningPolicy(),
      ...renderDirectorNotesPolicy(),
      ...renderRoutingPolicy(routingMode),
      ...renderProgressionPolicy(),
    ]),
    renderSection('Output Contract', [
      'Output ONLY a valid JSON object. Do not return prose, markdown, or a code fence.',
      'Use this shape; keep required keys exact and omit optional keys when they are not needed:',
      schema,
      'Field rules:',
      '- dialogueControl and dialogueControl.askFollowUp are required.',
      '- retrievalPlan and progressionUpdate are optional; omit them when no update is needed.',
      '- askFollowUp must always be stated explicitly; never infer it from mode alone.',
      '- retrievalPlan.queries and requiredFacts should be omitted or empty when required is false.',
      ...(routingMode !== 'none' ? renderRoutingFieldRules(routingMode) : []),
      '- Do not include a routing target that repeats the current Avatar with no actual change.',
    ]),
  ].join('\n\n')
}

function resolveRoutingMode(avatarContext: GmPromptAvatarContext): RoutingPromptMode {
  if (avatarContext.activeAvatarCount <= 1) return 'none'
  return avatarContext.hasLockedAvatars ? 'with_unlock' : 'no_unlock'
}

function renderDialogueControlPolicy(): string[] {
  return [
    'Dialogue control:',
    '- user_led: the user is directing the discussion; the Avatar should answer directly and avoid generic follow-up questions.',
    '- avatar_guided: the Avatar should answer directly and may offer one focused next direction.',
    '- avatar_led: the Avatar should take initiative and move the discussion forward.',
    '- repair: the next response must resolve a contradiction, misunderstanding, or loss of trust before progressing.',
    '- transition: the current subject should close or move toward another subject or Avatar.',
  ]
}

function renderRetrievalPlanningPolicy(): string[] {
  return [
    'Retrieval planning:',
    '- Set retrievalPlan.required true with priority "mandatory" when: the user corrected the Avatar; recent Avatar replies contradict one another; the discussion concerns an exact event, person, location, object, or timeline; the answer depends on what the Avatar knows versus canonical world truth; a previous Avatar statement may be unsupported; or the current topic is likely to continue and exact grounding is required.',
    '- Queries must be short, precise, and retrieval-oriented, e.g. "Mona quarantine camp" or "what Max knows about Mona\'s location" — avoid generic queries like "Mona information" or "family story".',
    '- You do not perform retrieval yourself; you only prepare it for the next Avatar turn.',
  ]
}

function renderDirectorNotesPolicy(): string[] {
  return [
    'Director notes:',
    '- directorNotes is optional. Include it only for narrative or character guidance not already represented by the structured fields above.',
    '- Omit directorNotes rather than restate permanent Avatar rules such as "stay in character" or "remain concise".',
    '- When userMessage.text is empty, no user message has been sent yet. Treat this as conversation opening guidance, and use directorNotes to tell the Avatar how to open instead of reacting to a message.',
  ]
}

function renderRoutingPolicy(routingMode: RoutingPromptMode): string[] {
  if (routingMode === 'none') return []

  const lines = [
    'Avatar routing:',
    '- stay does not require avatarId.',
    '- suggest and switch require an active, unlocked avatarId.',
  ]
  if (routingMode === 'with_unlock') {
    lines.push(
      '- unlock requires a locked avatarId (use unlockDecisions for more than one).',
      '- unlock_and_switch requires a locked avatarId that may immediately become active.',
    )
  }
  lines.push(
    '- Prefer suggest over switch when another avatar is relevant but not yet necessary as the active speaker.',
    '- Prefer stay unless the latest exchange provides clear evidence for routing.',
  )
  return lines
}

function renderProgressionPolicy(): string[] {
  return [
    'Progression:',
    '- progressionUpdate.progression is "none" by default; use "increase" only when the exchange meaningfully advances the experience.',
    '- objectiveId and reason are optional and must be evidence-based when included.',
  ]
}

function renderRoutingFieldRules(routingMode: RoutingPromptMode): string[] {
  const rules = ['- routing.avatarId must be one of the Avatars listed as available for this turn.']
  if (routingMode === 'with_unlock') {
    rules.push('- unlockDecisions must accompany actual unlocks, one short safe reason each.')
  }
  return rules
}

function buildOutputSchema(routingMode: RoutingPromptMode): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    dialogueControl: {
      mode: '<"user_led" | "avatar_guided" | "avatar_led" | "repair" | "transition">',
      askFollowUp: '<true | false>',
    },
    retrievalPlan: {
      required: '<true | false>',
      priority: '<"mandatory" | "optional" — omit when required is false>',
      queries: ['<short retrieval-oriented query>'],
      requiredFacts: ['<fact the next turn must ground>'],
    },
    directorNotes: '<optional one-sentence narrative guidance>',
  }

  if (routingMode !== 'none') {
    schema['routing'] = buildRoutingSchema(routingMode)
  }

  schema['progressionUpdate'] = {
    progression: '<"none" | "increase">',
    objectiveId: '<optional string>',
    reason: '<optional short evidence-based reason>',
  }

  return schema
}

function buildRoutingSchema(routingMode: RoutingPromptMode): Record<string, unknown> {
  const actions =
    routingMode === 'with_unlock'
      ? '"stay" | "suggest" | "switch" | "unlock" | "unlock_and_switch"'
      : '"stay" | "suggest" | "switch"'
  const routingSchema: Record<string, unknown> = {
    action: `<${actions}>`,
    avatarId: '<optional — not needed for "stay">',
    reason: '<optional>',
  }
  if (routingMode === 'with_unlock') {
    routingSchema['unlockDecisions'] = [{ avatarId: '<string>', reason: '<short reason>' }]
  }
  return routingSchema
}

function renderSection(title: string, lines: string[]): string {
  return [`## ${title}`, ...lines].join('\n')
}
