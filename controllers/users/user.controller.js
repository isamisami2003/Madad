const Rating = require('../../models/ratting.model');
const mongoose = require('mongoose');
const Chat = require('../../models/chat.model');
const Doctor = require('../../models/doctor.model');
const Consultation = require('../../models/consultation-request.model');
const Message = require('../../models/message.model');
const User = require('../../models/user.model');
const Joi = require('@hapi/joi');
const path = require('path');
const fs = require('fs');

const profileSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  birthDate: Joi.date().required(),
  gender: Joi.string().valid('male', 'female').required(),
  city: Joi.string().optional(),
  country: Joi.string().optional(),
  email: Joi.string().email().required(),
  profileImage: Joi.string().uri().optional(),
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  birthDate: Joi.date().optional(),
  gender: Joi.string().valid('male', 'female').optional(),
  city: Joi.string().optional(),
  country: Joi.string().optional(),
  email: Joi.string().email().optional(),
  profileImage: Joi.string().uri().optional(),
});

const completeProfile = async (req, res) => {
  try {
    const { firstName, lastName, birthDate, gender, city, country, email } = req.body;

    const { error } = profileSchema.validate({ firstName, lastName, birthDate, gender, city, country, email });
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await User.findOne({ phone: req.user.phone });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let birthdateUTC = new Date(Date.UTC(
      new Date(birthDate).getFullYear(),
      new Date(birthDate).getMonth(),
      new Date(birthDate).getDate()
    ));

    user.firstName = firstName;
    user.lastName = lastName;
    user.birthDate = birthdateUTC;
    user.gender = gender;
    user.city = city;
    user.country = country;
    user.email = email;

    if (req.file) {
      if (user.profileImage) {
        const oldImagePath = path.join(__dirname, '..', user.profileImage);
        fs.unlink(oldImagePath, (err) => {
          if (err) {
            console.warn('Failed to delete old image:', err.message);
          }
        });
      }

      user.profileImage = `/uploads/${req.file.filename}`;
    }

    await user.save();

    res.status(200).json({
      message: 'Profile completed successfully',
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ error: 'Unauthenticated' });
    const meId = new mongoose.Types.ObjectId(req.user._id);

    const user = await User.findById(meId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    let doctor = null;
    if (user.role === 'doctor') {
      doctor = await Doctor.findOne({ userId: user._id }).lean();
    return res.json({ user, doctor });
    }
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const updateProfile = async (req, res) => {
 try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const meId = new mongoose.Types.ObjectId(req.user._id);

    const raw = req.body || {};
    // التقط الحقول المسموحة فقط
    const allowed = ['firstName','lastName','birthdate','gender','city','email'];
    const picked = {};
    for (const k of allowed) if (raw[k] !== undefined) picked[k] = raw[k];

    // طبّع birthdate -> birthDate (UTC)
    if (picked.birthdate) {
      const dt = new Date(picked.birthdate);
      picked.birthDate = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      delete picked.birthdate;
    }

    // تحقّق Joi
    const { error } = updateProfileSchema.validate(picked);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // فريدة الإيميل
    if (picked.email) {
      const exists = await User.exists({ email: picked.email, _id: { $ne: meId } });
      if (exists) return res.status(400).json({ error: 'email is used from another user' });
    }

    // ممنوع تعديل مفاتيح حساسة إذا وصلت بالخطأ
    delete picked.firebaseUid; delete picked.uid;
    delete picked.phone; delete picked.role;
    delete picked.isBanned; delete picked._id;

    // تحديث مباشر ومضمون
    const updatedUser = await User.findByIdAndUpdate(
      meId,
      { $set: picked },
      { new: true, runValidators: true, context: 'query', omitUndefined: true }
    );
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    // صورة البروفايل (لو في ملف)
    if (req.file) {
      // احذف القديمة (لو مسارها صحيح)
      if (updatedUser.profileImage) {
        const oldIsAbs = path.isAbsolute(updatedUser.profileImage);
        const oldPath = oldIsAbs ? updatedUser.profileImage : path.join(__dirname, '..', updatedUser.profileImage);
        if (fs.existsSync(oldPath)) {
          fs.unlink(oldPath, (err) => err && console.warn('Failed to delete old image:', err.message));
        }
      }
      updatedUser.profileImage = `/uploads/${req.file.filename}`;
      await updatedUser.save(); // حفظ مسار الصورة فقط
    }

    // (اختياري) تحديث معلومات الطبيب
    let doctor = null;
    if (updatedUser.role === 'doctor') {
      const docAllowed = ['specialty','yearsOfExperience','workPlace','degreeFiles','licenseFiles','verifiedByAdmin'];
      const docUpdates = {};
      for (const k of docAllowed) if (raw[k] !== undefined) docUpdates[k] = raw[k];
      delete docUpdates.licenseNumber;

      if (Object.keys(docUpdates).length > 0) {
        doctor = await Doctor.findOneAndUpdate(
          { userId: updatedUser._id },
          { $set: docUpdates },
          { new: true }
        );
      } else {
        doctor = await Doctor.findOne({ userId: updatedUser._id }).lean();
      }
    }

    return res.status(200).json({
      message: 'User updated successfully',
      user: updatedUser,
      ...(updatedUser.role === 'doctor' ? { doctor } : {})
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate key', keyValue: err.keyValue });
    }
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};

//
const deleteProfile = async (req, res) => {
  // detect whether the connected topology supports transactions
  const topologyType = mongoose.connection && mongoose.connection.client && mongoose.connection.client.topology && mongoose.connection.client.topology.description && mongoose.connection.client.topology.description.type;
  const supportsTransactions = topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded';

  let session = null;
  if (supportsTransactions) {
    session = await mongoose.startSession();
    session.startTransaction();
  }

  try {
    if (!req.user || !req.user._id) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const meId = new mongoose.Types.ObjectId(req.user._id);

    // helper to optionally attach session
    const withSess = (query) => (session ? query.session(session) : query);

    const user = await withSess(User.findById(meId));
    if (!user) {
      if (session) { await session.commitTransaction(); session.endSession(); }
      return res.status(204).end();
    }

    if (user.role === 'doctor') {
      const doc = await withSess(Doctor.findOne({ userId: user._id }));
      if (doc) {
        const inProgress = await withSess(Consultation.exists({ assignedDoctorId: doc._id, status: 'in_progress' }));
        if (inProgress) throw new Error('Cannot delete profile while consultations are in progress');

        await withSess(Consultation.updateMany(
          { assignedDoctorId: doc._id },
          { $set: { assignedDoctorId: null } }
        ));

        await withSess(Doctor.deleteOne({ _id: doc._id }));
      }
    }

    const myConsultations = await withSess(Consultation.find({ userId: user._id }).select('_id'));
    const cIds = myConsultations.map(d => d._id);

    if (cIds.length) {
      const chats = await withSess(Chat.find({ consultationRequestId: { $in: cIds } }).select('_id'));
      const chatIds = chats.map(c => c._id);

      if (chatIds.length) {
        await withSess(Message.deleteMany({ chatId: { $in: chatIds } }));
        await withSess(Chat.deleteMany({ _id: { $in: chatIds } }));
      }
      await withSess(Consultation.deleteMany({ _id: { $in: cIds } }));
    }

    await withSess(User.deleteOne({ _id: user._id }));

    if (session) { await session.commitTransaction(); session.endSession(); }
      return res.status(200).json({ message: 'User deleted successfully' });
    
  } catch (err) {
    if (session) { await session.abortTransaction(); session.endSession(); }
    console.error(err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};
//

const getStatistics = async (req, res) => {
  try {
    const [volunteerDoctors, beneficiaryUsers] = await Promise.all([
      User.countDocuments({ role: 'doctor' }),
      User.countDocuments({ role: 'patient' })
    ]);

    res.status(200).json({ volunteerDoctors, beneficiaryUsers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred while fetching statistics', error: error.message });
  }
};

const getOtherParticipantInfo = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: 'Invalid chat ID' });
    }

    const chat = await Chat.findById(chatId).lean();
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    if (!chat.participants.map(id => id.toString()).includes(currentUserId)) {
      return res.status(403).json({ message: 'Access denied. Not a participant of this chat.' });
    }

    const otherUserId = chat.participants.find(id => id.toString() !== currentUserId);
    if (!otherUserId) return res.status(400).json({ message: 'No other participant found' });

    const otherUser = await User.findById(otherUserId)
      .select('firstName lastName profileImage')
      .lean();

    res.status(200).json({ participant: otherUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createRating = async (req, res) => {
  try {
    const { ratingValue, title, comment } = req.body;
    const userId = req.user._id;

    if (ratingValue == null) {
      return res.status(400).json({ message: 'Rating value is required' });
    }

    if (ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ message: 'Rating value must be between 1 and 5' });
    }

    const existingRating = await Rating.findOne({ userId });
    if (existingRating) {
      return res.status(400).json({ message: 'You have already submitted a rating.' });
    }

    const newRating = new Rating({
      userId,
      ratingValue,
      title,
      comment
    });

    await newRating.save();

    res.status(201).json({ message: 'Rating submitted successfully', rating: newRating });
  } catch (error) {
    console.error('Error creating rating:', error);
    res.status(500).json({ message: 'An error occurred while submitting the rating' });
  }
};

const checkUserRating = async (req, res) => {
  try {
    const userId = req.user._id;

    const existingRating = await Rating.findOne({ userId });

    res.status(200).json({ hasRating: !!existingRating });
  } catch (error) {
    console.error('Error checking user rating:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  completeProfile,
  getProfile,
  updateProfile,
  deleteProfile,
  getStatistics,
  getOtherParticipantInfo,
  createRating,
  checkUserRating
};