const Chat = require('../../models/chat.model');
const Doctor = require('../../models/doctor.model');
const ConsultationRequest = require('../../models/consultation-request.model');
const mongoose = require('mongoose');
const Joi = require('@hapi/joi');
const path = require('path');
const fs = require('fs');
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");
require("dayjs/locale/ar");
dayjs.extend(relativeTime);
dayjs.locale("ar");

const DoctorSchema = Joi.object({
  specialty: Joi.string().required(),
  licenseNumber: Joi.string().required(),
  yearsOfExperience: Joi.string().required(),
  workPlace: Joi.string().required(),
});

const updateDoctorSchema = Joi.object({
  specialty: Joi.string(),
  licenseNumber: Joi.string(),
  yearsOfExperience: Joi.number(),
  workPlace: Joi.string()
});

const completeDoctorData = async (req, res) => {
  try {
    const user = req.user;

    const { specialty, licenseNumber, yearsOfExperience, workPlace} = req.body;
    const { error } = DoctorSchema.validate({ specialty, licenseNumber, yearsOfExperience, workPlace});
    if (error) return res.status(400).json({ error: error.details[0].message });

    const degreeFiles = req.files?.degreeFiles;
    const licenseFiles = req.files?.licenseFiles;

    if (!degreeFiles || degreeFiles.length === 0) {
      return res.status(400).json({ error: 'degreeFile is required' });
    }

    if (!licenseFiles || licenseFiles.length === 0) {
      return res.status(400).json({ error: 'licenseFile is required' });
    }

    if (user.role !== 'doctor') {
      return res.status(403).json({ error: 'User is not a doctor' });
    }

    let doctor = await Doctor.findOne({ userId: user._id });
    if (!doctor) {
      doctor = new Doctor({ userId: user._id });
    }

    doctor.specialty = specialty;
    doctor.licenseNumber = licenseNumber;
    doctor.yearsOfExperience = yearsOfExperience;
    doctor.workPlace = workPlace;

    doctor.degreeFiles = degreeFiles.map(f => `/doctorFiles/${f.filename}`);
    doctor.licenseFiles = licenseFiles.map(f => `/doctorFiles/${f.filename}`);

    await doctor.save();

    res.status(200).json({
      message: 'Profile completed successfully',
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const updateDoctorProfile = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    if (req.user.role !== 'doctor') {
      return res.status(403).json({ error: 'Access denied, doctors only' });
    }

    const userId = new mongoose.Types.ObjectId(req.user._id);

    const raw = req.body || {};
    const allowed = ['specialty', 'licenseNumber', 'yearsOfExperience', 'workPlace'];
    const picked = {};

    for (const key of allowed) {
      if (raw[key] !== undefined) {
        picked[key] = raw[key];
      }
    }

    const { error } = updateDoctorSchema.validate(picked);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const doctor = await Doctor.findOne({ userId });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    Object.assign(doctor, picked);

    if (req.files?.degreeFiles && req.files.degreeFiles.length > 0) {
      if (doctor.degreeFiles?.length) {
        doctor.degreeFiles.forEach(filePath => {
          const fullPath = path.join(
            __dirname,
            '..',
            filePath.replace(/^\/+/, '') 
          );

          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        });
      }

      doctor.degreeFiles = req.files.degreeFiles.map(
        f => `/doctorFiles/${f.filename}`
      );
    }


    if (req.files?.licenseFiles && req.files.licenseFiles.length > 0) {
      if (doctor.licenseFiles?.length) {
        doctor.licenseFiles.forEach(filePath => {
          const fullPath = path.join(
            __dirname,
            '..',
            filePath.replace(/^\/+/, '') 
          );

          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        });
      }

      doctor.licenseFiles = req.files.licenseFiles.map(
        f => `/doctorFiles/${f.filename}`
      );
    }

    await doctor.save();

    return res.status(200).json({
      message: 'Doctor profile updated successfully',
      doctor,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: 'Server error',
      details: err.message,
    });
  }
};

const getAvailableConsultations = async (req, res) => {
  try {
    const userId = req.user._id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const doctor = await Doctor.findOne({ userId });
    if (!doctor) return res.status(403).json({ message: 'Access denied. Not a doctor.' });

    const specialty = doctor.specialty;
    const doctorId = doctor._id;

    const blockedIds = await ConsultationRequest.find({ assignedDoctorId: doctorId }).distinct('_id');
    const republishedIds = await ConsultationRequest.find({ republishedFromId: { $in: blockedIds } }).distinct('_id');

    const filter = {
      specialty,
      status: 'searching',
      _id: { $nin: [...blockedIds, ...republishedIds] }
    };

    const consultations = await ConsultationRequest.find(filter)
      .populate({
        path: 'userId',
        select: 'firstName lastName profileImage'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const result = consultations.map(consult => ({
      id: consult._id,
      title: consult.title,
      description: consult.description,
      status: consult.status,
      createdAt: consult.createdAt,
      patient: {
        name: `${consult.userId.firstName} ${consult.userId.lastName}`,
        profileImage: consult.userId.profileImage
      }
    }));

    const totalConsultations = await ConsultationRequest.countDocuments(filter);

    res.json({
      consultations: result,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalConsultations / limit),
        totalItems: totalConsultations
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getLatestAvailableConsultation = async (req, res) => {
  try {
    const userId = req.user._id;

    const doctor = await Doctor.findOne({ userId });
    if (!doctor) return res.status(403).json({ message: 'Access denied. Not a doctor.' });

    const specialty = doctor.specialty;
    const doctorId = doctor._id;

    const blockedIds = await ConsultationRequest.find({ assignedDoctorId: doctorId }).distinct('_id');
    const republishedIds = await ConsultationRequest.find({ republishedFromId: { $in: blockedIds } }).distinct('_id');

    const filter = {
      specialty,
      status: 'searching',
      _id: { $nin: [...blockedIds, ...republishedIds] }
    };

    const latestConsultation = await ConsultationRequest.findOne(filter)
      .populate({
        path: 'userId',
        select: 'firstName lastName profileImage'
      })
      .sort({ createdAt: -1 });

    if (!latestConsultation) {
      return res.status(404).json({ message: 'No available consultation found' });
    }

    const result = {
      id: latestConsultation._id,
      title: latestConsultation.title,
      description: latestConsultation.description,
      status: latestConsultation.status,
      createdAt: latestConsultation.createdAt,
      patient: {
        firstName: latestConsultation.userId.firstName,
        lastName: latestConsultation.userId.lastName,
        profileImage: latestConsultation.userId.profileImage
      }
    };

    res.json({ consultation: result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getConsultationStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const doctor = await Doctor.findOne({ userId });
    if (!doctor) {
      return res.status(403).json({ message: 'Access denied. Not a doctor.' });
    }

    const doctorId = doctor._id;
    const limit = parseInt(req.query.limit, 10) || 20;

    const [totalAssigned, inProgressCount, completedCount, searchingList, inProgressList, completedList] = await Promise.all([
      ConsultationRequest.countDocuments({ assignedDoctorId: doctorId }),
      ConsultationRequest.countDocuments({ assignedDoctorId: doctorId, status: 'in_progress' }),
      ConsultationRequest.countDocuments({ assignedDoctorId: doctorId, status: 'completed' }),
      ConsultationRequest.find({ specialty: doctor.specialty, status: 'searching' })
        .populate({ path: 'userId', select: 'firstName lastName profileImage' })
        .sort({ createdAt: -1 })
        .limit(limit),
      ConsultationRequest.find({ assignedDoctorId: doctorId, status: 'in_progress' })
        .populate({ path: 'userId', select: 'firstName lastName profileImage' })
        .sort({ updatedAt: -1 })
        .limit(limit),
      ConsultationRequest.find({ assignedDoctorId: doctorId, status: 'completed' })
        .populate({ path: 'userId', select: 'firstName lastName profileImage' })
        .sort({ updatedAt: -1 })
        .limit(limit),
    ]);

    const mapConsult = (c) => ({
      id: c._id,
      title: c.title,
      description: c.description,
      status: c.status,
      createdAt: c.createdAt,
      patient: c.userId ? {
        firstName: c.userId.firstName,
        lastName: c.userId.lastName,
        profileImage: c.userId.profileImage
      } : null
    });

    res.json({
      totalAssigned,
      inProgressCount,
      completedCount,
      searching: searchingList.map(mapConsult),
      inProgress: inProgressList.map(mapConsult),
      completed: completedList.map(mapConsult)
    });
  } catch (err) {
    console.error("Error in getConsultationStats:", err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


const getConsultationDetails = async (req, res) => {
  try {
    const userId = req.user._id;

    const doctor = await Doctor.findOne({ userId });
    if (!doctor) return res.status(403).json({ message: "Access denied. Not a doctor." });

    const consultationId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(consultationId)) {
      return res.status(400).json({ message: "Invalid consultation ID" });
    }

    const consultation = await ConsultationRequest.findById(consultationId)
      .populate({
        path: "userId",
        select: "firstName lastName gender birthDate city profileImage",
      });

    if (!consultation) return res.status(404).json({ message: "Consultation not found" });

    if (consultation.assignedDoctorId && consultation.assignedDoctorId.toString() !== doctor._id.toString()) {
      return res.status(403).json({ message: "Access denied. Consultation assigned to another doctor." });
    }

    if (consultation.specialty !== doctor.specialty) {
      return res.status(403).json({ message: "Access denied. Specialty mismatch." });
    }

    let age = null;
    
    if (consultation.userId?.birthDate) {
      age = dayjs().diff(dayjs(consultation.userId.birthDate), "year");
    }

    res.json({
      consultation: {
        id: consultation._id,
        title: consultation.title,
        description: consultation.description,
        attachments: consultation.attachments,
        specialty: consultation.specialty,
        status: consultation.status,
      },
      patient: consultation.userId
        ? {
          firstName: consultation.userId.firstName,
          lastName: consultation.userId.lastName,
          gender: consultation.userId.gender,
          age,
          city: consultation.userId.city,
        }
        : null,
      isDoctorVerified: doctor.verifiedByAdmin,
    });
  } catch (error) {
    console.error("Error fetching consultation details:", error.message);
    console.error(error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const startConsultation = async (req, res) => {
  try {
    const consultationId = req.params.id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(consultationId)) {
      return res.status(400).json({ message: 'Invalid consultation ID' });
    }

    const doctor = await Doctor.findOne({ userId });
    if (!doctor) return res.status(403).json({ message: 'Access denied. Not a doctor.' });

    const consultation = await ConsultationRequest.findById(consultationId).populate('userId');
    if (!consultation) return res.status(404).json({ message: 'Consultation not found' });

    if (consultation.status === 'completed') {
      return res.status(400).json({ message: 'Consultation already completed' });
    }

    if (consultation.status === 'in_progress' &&
        consultation.assignedDoctorId?.toString() !== doctor._id.toString()) {
      return res.status(400).json({ message: 'Consultation already in progress by another doctor' });
    }

    if (!consultation.userId) {
      return res.status(400).json({ message: 'Patient not found for this consultation' });
    }

    let chat = await Chat.findOne({ consultationRequestId: consultation._id });

    if (chat) {
      return res.status(200).json({
        message: 'Chat already exists for this consultation.',
        consultationId: consultation._id,
        chatId: chat._id
      });
    }

    if (!consultation.assignedDoctorId) {
      consultation.status = 'in_progress';
      consultation.assignedDoctorId = doctor._id;
      await consultation.save();
    }

    chat = new Chat({
      consultationRequestId: consultation._id,
      participants: [userId, consultation.userId._id]
    });
    await chat.save();

    res.status(201).json({
      message: 'Consultation started and chat created.',
      consultationId: consultation._id,
      chatId: chat._id
    });

  } catch (error) {
    console.error('Error starting consultation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const endConsultation = async (req, res) => {
  try {
    const consultationId = req.params.id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(consultationId)) {
      return res.status(400).json({ message: 'Invalid consultation ID' });
    }

    const consultation = await ConsultationRequest.findById(consultationId);
    if (!consultation) return res.status(404).json({ message: 'Consultation not found' });

    const doctor = await Doctor.findOne({ userId });
    if (!doctor || !consultation.assignedDoctorId?.equals(doctor._id)) {
      return res.status(403).json({ message: 'Access denied. Not the assigned doctor.' });
    }

    if (consultation.status !== 'in_progress') {
      return res.status(400).json({ message: 'Consultation cannot be ended. Current status: ' + consultation.status });
    }

    consultation.status = 'completed';
    await consultation.save();

    res.json({ 
      message: 'Consultation ended successfully', 
      consultation: {
        id: consultation._id,
        status: consultation.status
      }
    });
  } catch (error) {
    console.error('Error ending consultation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  completeDoctorData,
  updateDoctorProfile,
  getAvailableConsultations,
  getConsultationStats,
  getLatestAvailableConsultation,
  getConsultationDetails,
  startConsultation,
  endConsultation

};


