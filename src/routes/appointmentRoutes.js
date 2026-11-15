const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const authenticate = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.CAN_VIEW_APPOINTMENTS), appointmentController.listAppointments);
router.get('/:apptId', requirePermission(PERMISSIONS.CAN_VIEW_APPOINTMENTS), appointmentController.getAppointment);
router.post('/', requirePermission(PERMISSIONS.CAN_EDIT_APPOINTMENTS), appointmentController.createAppointment);
router.put('/:apptId', requirePermission(PERMISSIONS.CAN_EDIT_APPOINTMENTS), appointmentController.updateAppointment);
router.delete('/:apptId', requirePermission(PERMISSIONS.CAN_EDIT_APPOINTMENTS), appointmentController.deleteAppointment);

module.exports = router;
