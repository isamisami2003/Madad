const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const authorizeRoles = require('../../middlewares/role');

router.use(auth);
router.use(authorizeRoles('patient'));

module.exports = router;