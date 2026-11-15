const express = require('express');
const authRoutes = require('./authRoutes');
const profileRoutes = require('./profileRoutes');
const medicationRoutes = require('./medicationRoutes');
const scheduleRoutes = require('./scheduleRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const memberRoutes = require('./memberRoutes');
const pendingChangeRoutes = require('./pendingChangeRoutes');
const notificationRoutes = require('./notificationRoutes');
const aiRoutes = require('./aiRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/ai', aiRoutes);
router.use('/profiles', profileRoutes);
router.use('/profiles/:profileId/medications', medicationRoutes);
router.use('/profiles/:profileId/schedule', scheduleRoutes);
router.use('/profiles/:profileId/appointments', appointmentRoutes);
router.use('/profiles/:profileId/members', memberRoutes);
router.use('/profiles/:profileId/pending-changes', pendingChangeRoutes);
router.use('/profiles/:profileId/notifications', notificationRoutes);
router.use('/profile/notifications', notificationRoutes);

module.exports = router;
