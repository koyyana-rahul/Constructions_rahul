import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  /**
   * Global ignores.
   *
   * These must be their OWN top-level object with no `files` key. Inside a
   * config object that also has `files`, `ignores` only excludes those files
   * from THAT config - it does not stop ESLint from walking them. The
   * previous placement meant the committed `dist/` bundle was linted, which
   * produced ~400 meaningless errors and buried the real ones.
   */
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',

      /**
       * This is a plain-JavaScript project that does not depend on the
       * `prop-types` package, so `react/prop-types` can never be satisfied
       * without adding a dependency for no benefit. It reported 251 errors
       * that said nothing about correctness.
       */
      'react/prop-types': 'off',

      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]
