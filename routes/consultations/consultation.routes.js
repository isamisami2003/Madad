const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const authorizeRoles = require('../../middlewares/role');
const upload = require('../../middlewares/upload');
const {
  createConsultation,
  getConsultation,
  getUserConsultations,
  updateConsultation,
  deleteConsultation,
  republishConsultation
} = require('../../controllers/consultations/consultation.controller');

router.use(auth);
router.use(authorizeRoles('patient'));

router.post('/', upload.array('attachments'), createConsultation);
router.get('/get-user-consultations', getUserConsultations);
router.get('/:id', getConsultation);

//
router.patch('/:id', upload.array('attachments'), updateConsultation);
router.delete('/:id', deleteConsultation);
router.post('/republish/:id', republishConsultation);
//

module.exports = router;