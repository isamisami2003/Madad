const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  firstName: { type: String },
  lastName: { type: String },
  birthDate: { type: Date },
  gender: { type: String, enum: ['male', 'female'] },
  profileImage: { type: String },
  role: { type: String, enum: ['doctor', 'patient'], required: true },
  city: { type: String },
  email: { type: String, unique: true, sparse: true },
  isBanned: { type: Boolean, default: false }
}, { timestamps: true });

userSchema.pre('save', function (next) {
  const defaultMale = '../image/male.JPG';
  const defaultFemale = '../image/female.JPG';
  if (!this.profileImage && this.gender) {
    this.profileImage = this.gender === 'male' ? defaultMale : defaultFemale;
  }
  next();
});

module.exports = mongoose.model('User', userSchema, 'users');