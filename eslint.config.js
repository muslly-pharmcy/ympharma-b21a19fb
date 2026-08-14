// ESLint 9 flat config for YMPharma OS (TanStack Start + React 19 + TS).
// Type-aware linting is intentionally NOT enabled: `tsgo --noEmit` already
// owns type correctness and runs far faster in CI.
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.output/**',
      '.nitro/**',
      '.tanstack/**',
      '.wrangler/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'ios/**',
      'android/**',
      'public/**',
      'src/routeTree.gen.ts',
      'src/integrations/supabase/types.ts',
      'supabase/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',

      // Healthcare platform: `any` erodes the type guarantees the clinical and
      // auth layers rely on. Warn (not error) so the existing surface area is
      // visible without blocking the build; new code should avoid it.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',

      // --- Classified as warnings (style / known-safe patterns) ---
      // Deliberate control-character stripping in sanitisers and filters.
      'no-control-regex': 'warn',
      // Common `let x = base; if (...) x = ...` query-builder shape.
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
      'prefer-rest-params': 'warn',
      // TanStack `errorComponent`/`pendingComponent` are real components, but
      // the rule cannot infer that from the option-property name.
      'react-hooks/rules-of-hooks': 'warn',

    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-useless-assignment': 'warn',
    },
  },

  {
    files: ['tests/**/*.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
)
