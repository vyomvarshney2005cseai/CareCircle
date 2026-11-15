const app = require('../src/app');
const { getRepository } = require('../src/repositories');
const authService = require('../src/services/authService');

/**
 * Reset all in-memory repository data.
 */
async function clearDatabase() {
  const repo = getRepository();
  if (repo && typeof repo.clearAll === 'function') {
    await repo.clearAll();
  }
}

/**
 * Helper to bootstrap a test elder profile.
 */
async function createTestElder(overrides = {}) {
  const data = {
    elderName: 'Martha Stewart',
    elderEmail: 'martha@example.com',
    passcode: 'elderPass123',
    timezone: 'Asia/Kolkata',
    ...overrides
  };
  return authService.registerElder(data);
}

module.exports = {
  app,
  clearDatabase,
  createTestElder
};
