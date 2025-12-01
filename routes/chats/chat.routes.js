const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const authorizeRoles = require('../../middlewares/role');
const {
  getAllChats,
  getChatMessages,
  updateLastOpened,
  unreadMessagesCount,
  getChatStats,
  getMediaByChatId,
  getLinksByChatId,
  getDocumentsByChatId,
  getConsultationSummary,
  searchChats,
  searchMessages
} = require('../../controllers/chats/chat.controller');

router.use(auth);
router.use(authorizeRoles('doctor', 'patient'));

//
router.get('/', getAllChats);
router.put('/:chatId/last-opened', updateLastOpened);
router.get('/:chatId/messages', getChatMessages);
router.get('/unread/count', unreadMessagesCount);
router.get('/stats', getChatStats);
router.get('/:chatId/media', getMediaByChatId);
router.get('/:chatId/links', getLinksByChatId);
router.get('/:chatId/documents', getDocumentsByChatId);
router.get('/:id/summary', getConsultationSummary);
router.get('/search', searchChats);
router.get('/messages/search', searchMessages);
//

module.exports = router;