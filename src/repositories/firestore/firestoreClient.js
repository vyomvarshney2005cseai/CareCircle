const { Firestore } = require('@google-cloud/firestore');
const config = require('../../config');
const logger = require('../../utils/logger');

let firestoreInstance = null;

/**
 * Get or initialize the Google Cloud Firestore client.
 * @returns {Firestore}
 */
function getFirestoreClient() {
  if (!firestoreInstance) {
    logger.info({ projectId: config.gcpProjectId }, 'Initializing Firestore client');
    firestoreInstance = new Firestore({
      projectId: config.gcpProjectId,
      ignoreUndefinedProperties: true
    });
  }
  return firestoreInstance;
}

module.exports = {
  getFirestoreClient
};
