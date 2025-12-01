const express = require("express");
const router = express.Router();
const authRoutes = require("./auth/auth.routes");
const userRoutes = require("./users/user.routes");
const doctorRoutes = require("./doctors/doctor.routes");
const patientRoutes = require("./patients/patient.routes");
const chatRoutes = require("./chats/chat.routes");
const messageRoutes = require("./chats/message.routes");
const consultationRoutes = require("./consultations/consultation.routes");
const chatUploadRoutes = require("./uploads/chatUpload.routes");

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/doctors", doctorRoutes);
router.use("/patients", patientRoutes);
router.use("/chats", chatRoutes);
router.use("/messages", messageRoutes);
router.use("/consultations", consultationRoutes);
router.use("/uploads", chatUploadRoutes);

module.exports = router;