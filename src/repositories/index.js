const config = require('../config');
const logger = require('../utils/logger');
const MemoryRepository = require('./memory/memoryRepository');
const FirestoreRepository = require('./firestore/firestoreRepository');

let repositoryInstance = null;

/**
 * Get or initialize the repository singleton.
 * @param {import('./repositoryInterface')} [customRepo=null]
 * @returns {import('./repositoryInterface')}
 */
function getRepository(customRepo = null) {
  if (customRepo) {
    repositoryInstance = customRepo;
    return repositoryInstance;
  }

  if (!repositoryInstance) {
    if (config.dataStore === 'firestore') {
      logger.info('Using FirestoreRepository');
      repositoryInstance = new FirestoreRepository();
    } else {
      logger.info('Using MemoryRepository (in-memory storage)');
      repositoryInstance = new MemoryRepository();
    }
  }

  return repositoryInstance;
}

/**
 * Reset repository instance (primarily for tests).
 * @param {import('./repositoryInterface')} [newRepo=null]
 */
function setRepository(newRepo = null) {
  repositoryInstance = newRepo;
}

module.exports = {
  getRepository,
  setRepository
};
