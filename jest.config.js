/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/repositories/firestore/**'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/src/server.js',
    '/src/repositories/firestore/',
    '/src/repositories/repositoryInterface.js',
    '/src/services/ai/aiServiceInterface.js',
    '/src/services/ai/geminiAIService.js',
    '/src/services/mailer/mailerInterface.js',
    '/src/services/mailer/nodemailerMailer.js'
  ]
};
