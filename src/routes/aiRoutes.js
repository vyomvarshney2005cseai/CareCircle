const express = require('express');
const aiController = require('../controllers/aiController');
const authenticate = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');
const { aiLimiter } = require('../middlewares/rateLimiter');
const { upload } = require('../utils/fileValidator');
const { PERMISSIONS } = require('../constants/permissions');

const router = express.Router();

// All AI endpoints require authentication and per-user rate limiting
router.use(authenticate);
router.use(aiLimiter);

/**
 * 1. Multimodal Prescription Scanning
 * Accepts multipart/form-data with 'image' field (max 5MB, JPEG/PNG/WebP).
 */
router.post(
  '/scan-prescription',
  requirePermission(PERMISSIONS.CAN_EDIT_MEDS),
  upload.single('image'),
  aiController.scanPrescription
);

/**
 * 2. Natural-Language Conversational Assistant
 * Accepts { message, confirmed, confirmationData }.
 */
router.post(
  '/assistant',
  aiController.handleAssistant
);

/**
 * 3. Medication Interaction & Safety Check
 */
router.post(
  '/interaction-check',
  requirePermission(PERMISSIONS.CAN_VIEW_MEDS),
  aiController.checkInteractions
);

/**
 * 4. Routine Adherence Insights
 */
router.get(
  '/adherence-insight',
  requirePermission(PERMISSIONS.CAN_VIEW_ADHERENCE),
  aiController.getAdherenceInsight
);

module.exports = router;
