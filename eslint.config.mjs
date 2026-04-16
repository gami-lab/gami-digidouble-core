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
    },
  },
  {
    // Source files only — ignore build outputs and config files
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.*', '**/*.mjs'],
  },
);
