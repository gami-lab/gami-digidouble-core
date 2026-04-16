// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Disallow floating promises — important for async request handlers
      '@typescript-eslint/no-floating-promises': 'error',
      // Enforce explicit return types on module-boundary functions
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      // Allow unused function parameters prefixed with _
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Cyclomatic complexity — keep functions simple and testable
      complexity: ['error', 10],
      // File length — encourages single-responsibility modules
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      // Function length — encourages small, focused functions
      'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Source files only — ignore build outputs and config files
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.*', '**/*.mjs'],
  },
);
