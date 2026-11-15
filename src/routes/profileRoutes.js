const express = require('express');
const profileController = require('../controllers/profileController');
const authenticate = require('../middlewares/auth');
const { requireElder } = require('../middlewares/requirePermission');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/:profileId', profileController.getProfile);
router.put('/:profileId/settings', requireElder(), profileController.updateSettings);
router.get('/:profileId/audit', profileController.getProfileAuditLogs);

module.exports = router;
