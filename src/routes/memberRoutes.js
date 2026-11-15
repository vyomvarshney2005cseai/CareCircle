const express = require('express');
const memberController = require('../controllers/memberController');
const authController = require('../controllers/authController');
const authenticate = require('../middlewares/auth');
const { requireElder } = require('../middlewares/requirePermission');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// Members
router.get('/', memberController.listMembers);
router.put('/:memberId', requireElder(), memberController.updateMember);
router.delete('/:memberId', requireElder(), memberController.revokeMember);

// Invites
router.get('/invites/list', requireElder(), memberController.listInvites);
router.post('/invites', requireElder(), authController.createInvite);
router.delete('/invites/:inviteId', requireElder(), memberController.revokeInvite);

module.exports = router;
