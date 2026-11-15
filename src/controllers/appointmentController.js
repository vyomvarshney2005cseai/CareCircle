const appointmentService = require('../services/appointmentService');
const { appointmentSchema, appointmentUpdateSchema } = require('../utils/validators');

/**
 * List appointments for a profile.
 */
async function listAppointments(req, res, next) {
  try {
    const appts = await appointmentService.listAppointments(req.params.profileId);
    return res.status(200).json({ data: appts });
  } catch (err) {
    return next(err);
  }
}

/**
 * Get appointment by ID.
 */
async function getAppointment(req, res, next) {
  try {
    const appt = await appointmentService.getAppointment(req.params.profileId, req.params.apptId);
    return res.status(200).json({ data: appt });
  } catch (err) {
    return next(err);
  }
}

/**
 * Create a new appointment.
 * Returns 201 Created or 202 Accepted (if awaiting elder approval).
 */
async function createAppointment(req, res, next) {
  try {
    const validated = appointmentSchema.parse(req.body);
    const result = await appointmentService.createAppointment(req.params.profileId, req.user, validated);

    if (result.pending) {
      return res.status(202).json({ data: result });
    }
    return res.status(201).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

/**
 * Update an existing appointment.
 * Returns 200 OK or 202 Accepted (if awaiting elder approval).
 */
async function updateAppointment(req, res, next) {
  try {
    const validated = appointmentUpdateSchema.parse(req.body);
    const result = await appointmentService.updateAppointment(
      req.params.profileId,
      req.user,
      req.params.apptId,
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
 * Delete an appointment.
 * Returns 200 OK or 202 Accepted (if awaiting elder approval).
 */
async function deleteAppointment(req, res, next) {
  try {
    const result = await appointmentService.deleteAppointment(
      req.params.profileId,
      req.user,
      req.params.apptId
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
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment
};
