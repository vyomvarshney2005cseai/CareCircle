const express = require('express');
const medicationController = require('../controllers/medicationController');
const authenticate = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.CAN_VIEW_MEDS), medicationController.listMedications);
router.get(
  '/:medId',
  requirePermission(PERMISSIONS.CAN_VIEW_MEDS),
  medicationController.getMedication
);
router.post(
  '/',
  requirePermission(PERMISSIONS.CAN_EDIT_MEDS),
  medicationController.createMedication
);
router.put(
  '/:medId',
  requirePermission(PERMISSIONS.CAN_EDIT_MEDS),
  medicationController.updateMedication
);
router.delete(
  '/:medId',
  requirePermission(PERMISSIONS.CAN_EDIT_MEDS),
  medicationController.deleteMedication
);

module.exports = router;
