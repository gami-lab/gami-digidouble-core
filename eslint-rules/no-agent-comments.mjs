const CHANGE_NARRATION_START =
  /^(?:updated|added|changed|fixed|refactored|rewrote|replaced|removed|moved|renamed)\s+(?:the|this|that|these|a|an|it|to|for|so|in)\b|^now\s+(?:uses|returns|handles|supports|calls|checks|reads|writes|accepts)\b/i
const CHANGE_NARRATION_ANYWHERE =
  /\b(?:this|the)\s+(?:function|method|class|file|module|code|logic)\s+(?:was|has\s+been)\s+(?:added|updated|changed|rewritten|refactored|moved|replaced)\b|\bafter\s+the\s+(?:refactor|rewrite|change|cleanup)\b/i
const AI_ATTRIBUTION =
  /\b(?:generated|written|added|created|authored)\s+(?:by|with)\s+(?:ai|an?\s+(?:ai|llm|agent)|claude|copilot|codex|chatgpt|gpt)\b|\bai[-\s]generated\b/i
const EPIC_OR_PROMPT_REFERENCE =
  /\b(?:epic-\w+|epic\s+\d+(?:\.\d+)*|todo\s*\(\s*epic\b|prompt\s+\d+(?:\.\d+)*)\b/i
const ESLINT_DISABLE = /\beslint-disable(?:-next-line|-line)?\b/i
const ESLINT_REASON = /--\s+(\S.*)$/s
const MIN_REASON_WORDS = 3

function firstCommentLine(value) {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\*+\s?/, '').trim())
      .find((line) => line.length > 0) ?? ''
  )
}

function hasDisableReason(value) {
  const reason = ESLINT_REASON.exec(value)?.[1] ?? ''
  return (
    reason
      .trim()
      .split(/\s+/)
      .filter((word) => /\w/.test(word)).length >= MIN_REASON_WORDS
  )
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow change narration, AI attribution, epic references, and unexplained disables in comments',
    },
    schema: [],
    messages: {
      changeNarration: 'Use code or durable documentation instead of change-narrating comments.',
      aiAttribution: 'Comments must not attribute code to an AI tool or generated output.',
      epicReference:
        'Track follow-ups in durable documentation instead of referencing epics or prompts in code comments.',
      unexplainedDisable:
        'Every eslint-disable directive must include an inline "-- reason" of at least three words.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          const firstLine = firstCommentLine(comment.value)

          if (
            CHANGE_NARRATION_START.test(firstLine) ||
            CHANGE_NARRATION_ANYWHERE.test(comment.value)
          ) {
            context.report({ node: comment, messageId: 'changeNarration' })
          }

          if (AI_ATTRIBUTION.test(comment.value)) {
            context.report({ node: comment, messageId: 'aiAttribution' })
          }

          if (EPIC_OR_PROMPT_REFERENCE.test(comment.value)) {
            context.report({ node: comment, messageId: 'epicReference' })
          }

          if (ESLINT_DISABLE.test(comment.value) && !hasDisableReason(comment.value)) {
            context.report({ node: comment, messageId: 'unexplainedDisable' })
          }
        }
      },
    }
  },
}

export default rule
