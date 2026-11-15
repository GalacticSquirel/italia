// @ts-check
import { createRequire } from 'node:module';

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Load CommonJS plugins with require so they are the same instances that
// eslint-config-expo registers (ESLint rejects two different "import" plugins).
const require = createRequire(import.meta.url);
const expoConfig = require('eslint-config-expo/flat');
const importPlugin = require('eslint-plugin-import').flatConfigs.recommended.plugins.import;
const reactHooks = require('eslint-plugin-react-hooks');

const TS_FILES = ['**/*.ts', '**/*.tsx'];
const MOBILE = 'apps/mobile';

/** Scope a shared config to the mobile app. */
const forMobile = (config) => ({
  ...config,
  files: (config.files ?? ['**/*.{js,jsx,ts,tsx}']).map(
    (pattern) => `${MOBILE}/${String(pattern).replace(/^\*\*\//, '**/')}`,
  ),
});

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/coverage/',
    '**/.expo/',
    '**/expo-env.d.ts',
    `${MOBILE}/android/`,
    `${MOBILE}/ios/`,
    `${MOBILE}/drizzle/`,
  ]),

  // Everything
  js.configs.recommended,
  {
    plugins: { import: importPlugin },
    rules: {
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [
            { pattern: '@/**', group: 'internal' },
            { pattern: '@italia/**', group: 'internal', position: 'before' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
    },
  },

  // Expo's config for the app (React, React Native, Expo rules)
  ...expoConfig.map(forMobile),

  // Resolve imports the way TypeScript does (path aliases, workspace packages).
  {
    settings: {
      'import/resolver': {
        typescript: {
          project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
          noWarnOnMultipleProjects: true,
        },
        node: true,
      },
    },
  },

  // TypeScript, type-aware
  {
    files: TS_FILES,
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  // React hooks everywhere React is used
  {
    files: [`${MOBILE}/**/*.{ts,tsx}`],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // Tests
  {
    files: ['**/*.test.{ts,tsx}', `${MOBILE}/jest.setup.ts`],
    languageOptions: { globals: { ...globals.jest } },
  },

  // Plain JS config files (Node, CommonJS)
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },

  // packages/* are platform-neutral: no React, React Native or Expo.
  {
    files: ['packages/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
              message: 'packages/* must not depend on React.',
            },
            {
              group: ['react-native', 'react-native/*', 'react-native-*', '@react-native/*'],
              message: 'packages/* must not depend on React Native.',
            },
            {
              group: ['expo', 'expo/*', 'expo-*', '@expo/*'],
              message: 'packages/* must not depend on Expo.',
            },
          ],
        },
      ],
    },
  },
]);
