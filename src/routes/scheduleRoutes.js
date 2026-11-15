const express = require('express');
const scheduleController = require('../controllers/scheduleController');
const authenticate = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/today', requirePermission(PERMISSIONS.CAN_VIEW_MEDS), scheduleController.getTodaySchedule);
router.post('/doses/:doseId/action', requirePermission(PERMISSIONS.CAN_VIEW_MEDS), scheduleController.recordDoseAction);
router.get('/adherence', requirePermission(PERMISSIONS.CAN_VIEW_ADHERENCE), scheduleController.getAdherence);

module.exports = router;
