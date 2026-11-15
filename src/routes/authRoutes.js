const express = require('express');
const authController = require('../controllers/authController');
const authenticate = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');
const { requireElder } = require('../middlewares/requirePermission');

const router = express.Router();

// Public auth routes (rate limited)
router.post('/register-elder', authLimiter, authController.registerElder);
router.post('/join', authLimiter, authController.join);
router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);

// Protected auth routes
router.get('/me', authenticate, authController.getMe);
router.post('/profiles/:profileId/invites', authenticate, requireElder(), authController.createInvite);

module.exports = router;
