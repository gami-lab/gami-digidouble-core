const CHANGE_NARRATION = /^(updated|added|changed|fixed|now|refactored)\b/i
const AI_ATTRIBUTION = /\b(?:added\s+by\s+ai|generated\s+by|claude|copilot|codex)\b/i
const EPIC_OR_PROMPT_REFERENCE =
  /\b(?:epic-\w+|epic\s+\d+(?:\.\d+)*|todo\s*\(\s*epic\b|prompt\s+\d+(?:\.\d+)*)\b/i
const ESLINT_DISABLE = /\beslint-disable(?:-next-line|-line)?\b/i
const ESLINT_REASON = /--\s+\S/

function firstCommentLine(value) {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\*+\s?/, '').trim())
      .find((line) => line.length > 0) ?? ''
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
        'Every eslint-disable directive must include an inline "-- reason" explanation.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          const firstLine = firstCommentLine(comment.value)

          if (CHANGE_NARRATION.test(firstLine)) {
            context.report({ node: comment, messageId: 'changeNarration' })
          }

          if (AI_ATTRIBUTION.test(comment.value)) {
            context.report({ node: comment, messageId: 'aiAttribution' })
          }

          if (EPIC_OR_PROMPT_REFERENCE.test(comment.value)) {
            context.report({ node: comment, messageId: 'epicReference' })
          }

          if (ESLINT_DISABLE.test(comment.value) && !ESLINT_REASON.test(comment.value)) {
            context.report({ node: comment, messageId: 'unexplainedDisable' })
          }
        }
      },
    }
  },
}

export default rule
