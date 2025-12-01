const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const upload = require('../../middlewares/upload');
const authorizeRoles = require('../../middlewares/role');
const {
  getProfile,
  updateProfile,
  completeProfile,
  deleteProfile,
  getStatistics,
  getOtherParticipantInfo,
  createRating,
  checkUserRating
} = require('../../controllers/users/user.controller');

router.use(auth);
router.use(authorizeRoles('doctor', 'patient'));

//
router.get('/profile', getProfile);
router.patch('/profile', upload.single("profileImage"), updateProfile);
router.delete('/profile', deleteProfile);
//

router.patch('/profile/complete', upload.single("profileImage"), completeProfile);
router.get('/statistics', getStatistics);
router.get('/:chatId/other-user', getOtherParticipantInfo);
router.post('/ratings', createRating);
router.get('/ratings/check', checkUserRating);

module.exports = router;
