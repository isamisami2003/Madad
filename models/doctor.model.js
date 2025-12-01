const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  specialty: { type: String, required: true },
  licenseNumber: { type: String, required: true, unique: true },
  yearsOfExperience: { type: Number, required: true },
  workPlace: { type: String, required: true },
  degreeFiles: { type: [String], required: true },
  licenseFiles: { type: [String], required: true },
  verifiedByAdmin: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Doctor', doctorSchema, 'doctors');