import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        crypto: 'readonly',
        performance: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly'
      }
    },
    plugins: {
      import: importPlugin
    },
    rules: {
      // Airbnb base rules (manually specified key ones)
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'warn',
      'no-var': 'error',
      'prefer-const': 'error',
      'arrow-spacing': 'error',
      'comma-dangle': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'space-before-function-paren': ['error', 'never'],
      'keyword-spacing': 'error',
      'space-infix-ops': 'error',
      'eol-last': 'error',
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
      'brace-style': ['error', '1tbs'],
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always'],
      'no-eq-null': 'error',
      'no-undef': 'error',
      'no-unused-expressions': 'error',
      'no-use-before-define': ['error', { functions: false }],
      'camelcase': ['error', { properties: 'never' }],
      'new-cap': 'error',
      'no-underscore-dangle': 'off',
      'max-len': ['error', { code: 120, ignoreUrls: true }],
      
      // Import rules
      'import/no-unresolved': 'off', // Disabled for browser modules
      'import/extensions': ['error', 'always', { ignorePackages: true }],
      'import/prefer-default-export': 'off',
      'import/no-default-export': 'off'
    }
  },
  {
    files: ['**/*.test.js', '**/*.spec.js', 'tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        vitest: 'readonly',
        global: 'writable'
      }
    },
    rules: {
      'no-console': 'off',
      'max-len': 'off'
    }
  },
  prettierConfig
];
