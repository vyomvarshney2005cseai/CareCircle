const prettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      '.git/**'
    ]
  },
  {
    files: ['src/**/*.js', 'tests/**/*.js', 'public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        // Browser globals (for public/js)
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        FormData: 'readonly',
        fetch: 'readonly',
        confirm: 'readonly',
        speechSynthesis: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        webkitSpeechRecognition: 'readonly',
        SpeechRecognition: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        ui: 'writable',
        auth: 'writable',
        api: 'writable',
        app: 'writable',
        speech: 'writable'
      }
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^(req|res|next|_)',
          varsIgnorePattern: '^(api|auth|app|speech|ui|_)',
          caughtErrors: 'none'
        }
      ],
      'no-console': 'off',
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    // Abstract interfaces only document parameter contracts
    files: ['src/repositories/repositoryInterface.js', 'src/services/**/*Interface.js'],
    rules: {
      'no-unused-vars': 'off'
    }
  },
  prettier
];
