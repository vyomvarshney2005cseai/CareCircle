const express = require('express');
const notificationController = require('../controllers/notificationController');
const authenticate = require('../middlewares/auth');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.post('/test', notificationController.sendTestReminder);
router.get('/', notificationController.listNotifications);

module.exports = router;
