// ESLint 9 Flat Config
// Migrated from .eslintrc.json

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Base recommended configs
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Global configuration
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        project: true,
      },
    },
  },

  // Custom rules
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // Ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/build/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/out/**',
      '**/*.d.ts',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/apps/web/**', // Web app has its own eslint config
    ],
  }
);
