const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  specialty: { type: String, required: true },
  description: { type: String, required: true },
  title: { type: String, required: true },
  attachments: [{ type: String, required: true }],
  status: { type: String, enum: ['searching', 'in_progress', 'completed'], default: 'searching' },
  assignedDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  republishedFromId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultationRequest' }
}, { timestamps: true });

module.exports = mongoose.model('ConsultationRequest', consultationSchema, 'consultation_requests');