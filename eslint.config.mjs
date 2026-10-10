// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import noAgentComments from './eslint-rules/no-agent-comments.mjs'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    plugins: {
      local: {
        rules: {
          'no-agent-comments': noAgentComments,
        },
      },
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'local/no-agent-comments': 'error',
      'no-warning-comments': [
        'error',
        { terms: ['TODO', 'FIXME', 'HACK', 'XXX'], location: 'anywhere' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      complexity: ['error', 10],
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.*', '**/*.mjs'],
  },
)
