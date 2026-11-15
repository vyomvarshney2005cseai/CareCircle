const express = require('express');
const pendingChangeController = require('../controllers/pendingChangeController');
const authenticate = require('../middlewares/auth');
const { requireElder } = require('../middlewares/requirePermission');

const router = express.Router({ mergeParams: true });

router.use(authenticate);
router.use(requireElder());

router.get('/', pendingChangeController.listPendingChanges);
router.post('/:changeId/review', pendingChangeController.reviewPendingChange);

module.exports = router;
