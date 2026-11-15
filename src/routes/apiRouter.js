const express = require('express');
const authRoutes = require('./authRoutes');
const profileRoutes = require('./profileRoutes');
const medicationRoutes = require('./medicationRoutes');
const scheduleRoutes = require('./scheduleRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const memberRoutes = require('./memberRoutes');
const pendingChangeRoutes = require('./pendingChangeRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/profiles', profileRoutes);
router.use('/profiles/:profileId/medications', medicationRoutes);
router.use('/profiles/:profileId/schedule', scheduleRoutes);
router.use('/profiles/:profileId/appointments', appointmentRoutes);
router.use('/profiles/:profileId/members', memberRoutes);
router.use('/profiles/:profileId/pending-changes', pendingChangeRoutes);

module.exports = router;
