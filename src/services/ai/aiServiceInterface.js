/**
 * Abstract interface for Gemini AI services in CareCircle.
 */
class AIServiceInterface {
  /**
   * Extract draft medications from an uploaded prescription image.
   * @param {{ buffer: Buffer, mimeType: string }} fileData
   * @returns {Promise<{ medicines: Array<object>, notes: string }>}
   */
  async scanPrescription(fileData) {
    throw new Error('Not implemented');
  }

  /**
   * Parse a natural language user query into an actionable intent.
   * @param {string} message
   * @param {object} [context={}]
   * @returns {Promise<{ action: string, reply: string, params: object }>}
   */
  async parseAssistantIntent(message, context = {}) {
    throw new Error('Not implemented');
  }

  /**
   * Check medication combinations for safety, interactions, and conflicts.
   * @param {Array<object>} medications
   * @returns {Promise<{ severity: string, summary: string, findings: Array<object>, disclaimer: string }>}
   */
  async checkInteractions(medications) {
    throw new Error('Not implemented');
  }

  /**
   * Generate personalized adherence insights from recent dose logs.
   * @param {Array<object>} doseLogs
   * @param {Array<object>} medications
   * @returns {Promise<{ insight: string, positiveNote?: string, recommendation?: string }>}
   */
  async generateAdherenceInsight(doseLogs, medications) {
    throw new Error('Not implemented');
  }
}

module.exports = AIServiceInterface;
