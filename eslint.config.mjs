// ESLint flat config for the whole monorepo: `pnpm lint`.
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const REACT_FILES = [
  'apps/web/src/**/*.tsx',
  'apps/admin/src/**/*.tsx',
  'apps/video-worker/remotion/**/*.tsx',
  'packages/template-engine/src/**/*.tsx',
  'packages/video-engine/src/**/*.tsx',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/generated/**',
      '**/coverage/**',
      '**/next-env.d.ts',
      'apps/video-worker/remotion-bundle/**',
      'ui-shots/**',
      'admin-shots/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      // Note: no consistent-type-imports. NestJS dependency injection reads constructor
      // parameter types at runtime (emitDecoratorMetadata), so those imports must stay values.
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    files: REACT_FILES,
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/admin/src/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Template and upload images come from signed storage URLs of unknown size.
      '@next/next/no-img-element': 'off',
    },
    settings: { next: { rootDir: ['apps/web/', 'apps/admin/'] } },
  },
  {
    // Tests and scripts may use loose types and CommonJS.
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts', 'infrastructure/scripts/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['**/*.cjs', 'apps/api/test/**/*.js', 'apps/*/jest.config.js', 'apps/api/test/*.config.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['infrastructure/scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
