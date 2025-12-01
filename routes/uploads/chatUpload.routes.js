const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const upload = require('../../middlewares/upload');
const { uploadChatFiles } = require('../../controllers/uploads/chatUpload.controller');

router.post('/chat', upload.array('attachments'), auth, uploadChatFiles);

module.exports = router;