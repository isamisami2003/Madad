const Joi = require('@hapi/joi');
const mongoose = require('mongoose');
const path = require('path');
const Consultation = require('../../models/consultation-request.model');
const Chat = require('../../models/chat.model');
const Message = require('../../models/message.model');
const Doctor = require('../../models/doctor.model');
const fs = require('fs');
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");
require("dayjs/locale/ar");
dayjs.extend(relativeTime);
dayjs.locale("ar");

const consultationSchema = Joi.object({
  specialty: Joi.string().required(),
  description: Joi.string().required(),
  title: Joi.string().required(),
});

const updateConsultationSchema = Joi.object({
  specialty: Joi.string().optional(),
  description: Joi.string().optional(),
  title: Joi.string().optional(),
});

const createConsultation = async (req, res) => {
  try {
    const { specialty, description, title } = req.body;

    const existingConsultation = await Consultation.findOne({
      userId: req.user._id,
      specialty,
      status: { $in: ["searching", "in_progress"] }
    });

    if (existingConsultation) {
      return res.status(400).json({
        error: `You already have an active consultation in ${specialty}. Please complete or close it before creating a new one.`
      });
    }

    const files = req.files || [];
    const attachments = (files && files.length) ? files.map(file => `/patientFiles/${file.filename}`) : [];

    const consultation = new Consultation({
      userId: req.user._id,
      specialty,
      description,
      title,
      attachments,
      status: "searching",
    });

    await consultation.save();

    res.status(201).json({
      message: 'Consultation created successfully',
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const getConsultation = async (req, res) => {
  try {
    const consultationId = req.params.id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(consultationId)) {
      return res.status(400).json({ message: "Invalid consultation ID" });
    }

    // جلب الاستشارة + بيانات المستخدم
    const consultation = await Consultation.findById(consultationId)
      .populate({
        path: "userId",
        select: "firstName lastName gender birthDate city profileImage",
      });

    if (!consultation) {
      return res.status(404).json({ message: "Consultation not found" });
    }

    // التأكد أن الاستشارة تعود لنفس المستخدم
    if (consultation.userId._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Access denied." });
    }

    // حساب العمر
    let age = null;
    if (consultation.userId?.birthDate) {
      age = dayjs().diff(dayjs(consultation.userId.birthDate), "year");
    }

    res.status(200).json({
      consultation: {
        id: consultation._id,
        title: consultation.title,
        description: consultation.description,
        attachments: consultation.attachments,
        specialty: consultation.specialty,
        status: consultation.status,
        createdAt: consultation.createdAt,
      },
      user: {
        firstName: consultation.userId.firstName,
        lastName: consultation.userId.lastName,
        gender: consultation.userId.gender,
        age,
        city: consultation.userId.city,
      },
    });
  } catch (error) {
    console.error("Error fetching consultation:", error.message);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


const getUserConsultations = async (req, res) => {
  try {
    const consultations = await Consultation.find({ userId: req.user._id });

    if (!consultations || consultations.length === 0) {
      return res.status(404).json({ error: 'No consultations found for this user' });
    }

    res.status(200).json({ consultations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};

//
const updateConsultation = async (req, res) => {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ error: 'Unauthenticated' });
    const meId = new mongoose.Types.ObjectId(req.user._id);
    const meRole = req.user.role || 'patient';

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'consultationId is required' });

    const c = await Consultation.findById(id);
    if (!c) return res.status(404).json({ error: 'Consultation not found' });

    const isOwner = c.userId.toString() === meId.toString();

    let isAssignedDoctor = false;
    if (meRole === 'doctor' && c.assignedDoctorId) {
      const myDoctor = await Doctor.findOne({ userId: meId }).select('_id');
      isAssignedDoctor = !!(myDoctor && c.assignedDoctorId.toString() === myDoctor._id.toString());
    }

    // Build updates from provided body fields and files
    let updates = {};

    // If files uploaded, set attachments (replace behavior). Adjust if you want append.
    if (req.files && req.files.length) {
      updates.attachments = req.files.map(f => `/patientFiles/${f.filename}`);
    }

    // Copy provided fields from body
    for (const k of Object.keys(req.body || {})) {
      // Skip undefined values
      if (typeof req.body[k] === 'undefined') continue;
      updates[k] = req.body[k];
    }

    // Authorization / allowed fields
    if (meRole === 'patient' && isOwner) {
      const allowed = ['title','description','attachments','specialty','status'];
      updates = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
    } else if (meRole === 'doctor' && isAssignedDoctor) {
      // doctors may only update status
      if ('status' in updates) updates = { status: updates.status };
      else updates = {};
    } else if (meRole === 'admin') {
      // admin can update any fields
    } else {
      return res.status(403).json({ error: 'Not allowed to update this consultation' });
    }

    // Prevent changing content fields after completion
    if (c.status === 'completed') {
      delete updates.title;
      delete updates.description;
      delete updates.attachments;
      delete updates.specialty;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    const updated = await Consultation.findByIdAndUpdate(id, updates, { new: true });
    return res.status(200).json({message: 'Consultation updated successfully' ,updated});
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};

const deleteConsultation = async (req, res) => {

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
    const meRole = req.user.role || 'patient';

    const { id } = req.params;
    if (!id) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      return res.status(400).json({ error: 'consultationId is required' });
    }

    const withSess = (query) => (session ? query.session(session) : query);

    const consultation = await withSess(Consultation.findById(id));
    if (!consultation) {
      if (session) { await session.commitTransaction(); session.endSession(); }
      return res.status(404).json({ error: 'Consultation not found' });
    }

    const isOwner = consultation.userId.toString() === meId.toString();
    if (!(isOwner || meRole === 'admin')) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      return res.status(403).json({ error: 'Not allowed to delete this consultation' });
    }

    // find related chat (if exists)
    const chat = await withSess(Chat.findOne({ consultationRequestId: consultation._id }).select('_id'));
    if (chat) {
      const chatId = chat._id;

      // remove files referenced by messages (only local files)
      const messages = await withSess(Message.find({ chatId }).lean());
      for (const m of messages) {
        if (!m || !m.url) continue;
        // skip remote urls
        if (typeof m.url === 'string' && (m.url.startsWith('http://') || m.url.startsWith('https://'))) continue;

        let filePath = m.url.replace(/^\/+/, '');
        const absPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', filePath);
        try {
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        } catch (err) {
          console.warn('Failed to delete message file:', absPath, err.message);
        }
      }

      // delete messages and chat
      await withSess(Message.deleteMany({ chatId }));
      await withSess(Chat.deleteOne({ _id: chatId }));
    }

    // delete consultation attachments from disk (local files)
    if (consultation.attachments && consultation.attachments.length) {
      for (const a of consultation.attachments) {
        if (!a) continue;
        if (typeof a === 'string' && (a.startsWith('http://') || a.startsWith('https://'))) continue;

        let attPath = a.replace(/^\/+/, '');
        const absAtt = path.isAbsolute(attPath) ? attPath : path.join(__dirname, '..', attPath);
        try {
          if (fs.existsSync(absAtt)) fs.unlinkSync(absAtt);
        } catch (err) {
          console.warn('Failed to delete attachment file:', absAtt, err.message);
        }
      }
    }

    await withSess(Consultation.deleteOne({ _id: consultation._id }));

    if (session) { await session.commitTransaction(); session.endSession(); }
    return res.status(200).json({ message: 'Consultation and related data deleted successfully' });

  } catch (err) {
    if (session) { await session.abortTransaction(); session.endSession(); }
    console.error(err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }

};

const republishConsultation = async (req, res) => {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ error: 'Unauthenticated' });

    const meId = req.user._id;
    const meRole = req.user.role || 'patient';

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'consultationId is required' });

    const c = await Consultation.findById(id);
    if (!c) return res.status(404).json({ error: 'Consultation not found' });

    const isOwner = c.userId.toString() === meId.toString();
    if (!isOwner && meRole !== 'admin') {
      return res.status(403).json({ error: 'Not allowed to republish this consultation' });
    }

    // Allow republishing only when the consultation is completed
    if (c.status !== 'completed') {
      return res.status(400).json({ error: "Can only republish a consultation when its status is 'completed'" });
    }

    // Create a new consultation based on the old one and mark the origin
    const newConsultation = new Consultation({
      userId: c.userId,
      specialty: c.specialty,
      description: c.description,
      title: c.title,
      attachments: c.attachments || [],
      status: 'searching',
      republishedFromId: c._id
    });

    await newConsultation.save();

    return res.status(201).json({ message: 'Consultation republished successfully', consultation: newConsultation });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
//

module.exports = {
  createConsultation,
  getConsultation,
  getUserConsultations,
  updateConsultation,
  deleteConsultation,
  republishConsultation
};
