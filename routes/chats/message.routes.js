const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const authorizeRoles = require('../../middlewares/role');
const {
  deleteAllMessages,
  deleteMessageForOne,
  deleteMessageForBoth
} = require('../../controllers/chats/message.controller');

// router.use(auth);
// router.use(authorizeRoles('doctor', 'patient'));

//
router.delete('/:chatId/all', deleteAllMessages);
router.delete('/:messageId/one', deleteMessageForOne);
//

module.exports = router;