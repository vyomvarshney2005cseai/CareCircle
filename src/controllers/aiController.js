const aiService = require('../services/aiService');
const { validateMagicBytes } = require('../utils/fileValidator');
const AppError = require('../errors/appError');
const logger = require('../utils/logger');

/**
 * Controller handling Google Gemini AI multimodal vision, conversational assistance,
 * drug safety evaluations, and adherence routines.
 */
class AIController {
  /**
   * 1. Multimodal Prescription Scanning
   * POST /api/ai/scan-prescription
   */
  async scanPrescription(req, res, next) {
    try {
      if (!req.file) {
        throw AppError.badRequest(
          'No prescription image uploaded. Please upload a JPEG, PNG, or WebP image.'
        );
      }

      const { buffer, mimetype } = req.file;

      // Validate magic byte signatures
      const isValidMagic = validateMagicBytes(buffer, mimetype);
      if (!isValidMagic) {
        throw AppError.unprocessable(
          'Invalid image content. File signature does not match declared MIME type.'
        );
      }

      logger.info(
        {
          profileId: req.user.profileId,
          memberId: req.user.memberId,
          bytes: buffer.length,
          mimetype
        },
        'Processing prescription scan request'
      );

      const draftResult = await aiService.scanPrescription({
        buffer,
        mimeType: mimetype
      });

      return res.status(200).json(draftResult);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * 2. Natural-Language Conversational Assistant
   * POST /api/ai/assistant
   */
  async handleAssistant(req, res, next) {
    try {
      const profileId = req.user.profileId;
      const { message, confirmed, confirmationData } = req.body;

      logger.info(
        { profileId, memberId: req.user.memberId, confirmed: !!confirmed },
        'Processing assistant query'
      );

      const result = await aiService.handleAssistantMessage(profileId, req.user, {
        message,
        confirmed: !!confirmed,
        confirmationData
      });

      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * 3. Medication Interaction & Safety Check
   * POST /api/ai/interaction-check
   */
  async checkInteractions(req, res, next) {
    try {
      const profileId = req.user.profileId;
      logger.info(
        { profileId, memberId: req.user.memberId },
        'Performing medication interaction check'
      );

      const safetyResult = await aiService.checkInteractions(profileId);
      return res.status(200).json(safetyResult);
    } catch (err) {
      return next(err);
    }
  }

  /**
   * 4. Routine Adherence Insights
   * GET /api/ai/adherence-insight
   */
  async getAdherenceInsight(req, res, next) {
    try {
      const profileId = req.user.profileId;
      logger.info({ profileId, memberId: req.user.memberId }, 'Fetching AI adherence insight');

      const insight = await aiService.getAdherenceInsight(profileId);
      return res.status(200).json(insight);
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new AIController();
