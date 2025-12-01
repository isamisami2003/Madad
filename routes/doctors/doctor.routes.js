const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const authorizeRoles = require('../../middlewares/role');
const upload = require('../../middlewares/upload');
const {
  completeDoctorData,
  getAvailableConsultations,
  getConsultationStats,
  getLatestAvailableConsultation,
  getConsultationDetails,
  startConsultation,
  endConsultation
} = require('../../controllers/doctors/doctor.controller');

router.use(auth);
router.use(authorizeRoles('doctor'));

router.patch(
  '/profile/complete',
  upload.fields([
    { name: 'degreeFiles'},
    { name: 'licenseFiles'}
  ]),
     completeDoctorData
);

router.get('/consultations/available', getAvailableConsultations);
router.get('/consultations/latest', getLatestAvailableConsultation);
router.get('/consultations/stats', getConsultationStats);
router.get('/consultations/:id', getConsultationDetails);
router.post('/consultations/:id/start', startConsultation);
router.post('/consultations/:id/end', endConsultation);

module.exports = router;