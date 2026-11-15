const medicationService = require('../services/medicationService');
const { medicationSchema, medicationUpdateSchema } = require('../utils/validators');

/**
 * List medications for a profile.
 */
async function listMedications(req, res, next) {
  try {
    const filterActive = req.query.active === 'true';
    const meds = await medicationService.listMedications(req.params.profileId, filterActive);
    return res.status(200).json({ data: meds });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get medication by ID.
 */
async function getMedication(req, res, next) {
  try {
    const med = await medicationService.getMedication(req.params.profileId, req.params.medId);
    return res.status(200).json({ data: med });
  } catch (err) {
    return next(err);
  }
}

/**
 * Create a new medication.
 * Returns 201 Created or 202 Accepted (if awaiting elder approval).
 */
async function createMedication(req, res, next) {
  try {
    const validated = medicationSchema.parse(req.body);
    const result = await medicationService.createMedication(
      req.params.profileId,
      req.user,
      validated
    );

    if (result.pending) {
      return res.status(202).json({ data: result });
    }
    return res.status(201).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

/**
 * Update an existing medication.
 * Returns 200 OK or 202 Accepted (if awaiting elder approval).
 */
async function updateMedication(req, res, next) {
  try {
    const validated = medicationUpdateSchema.parse(req.body);
    const result = await medicationService.updateMedication(
      req.params.profileId,
      req.user,
      req.params.medId,
      validated
    );

    if (result.pending) {
      return res.status(202).json({ data: result });
    }
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

/**
 * Delete a medication.
 * Returns 200 OK or 202 Accepted (if awaiting elder approval).
 */
async function deleteMedication(req, res, next) {
  try {
    const result = await medicationService.deleteMedication(
      req.params.profileId,
      req.user,
      req.params.medId
    );

    if (result.pending) {
      return res.status(202).json({ data: result });
    }
    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listMedications,
  getMedication,
  createMedication,
  updateMedication,
  deleteMedication
};
