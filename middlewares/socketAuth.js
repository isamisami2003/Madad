const admin = require("../src/firebase");
const User = require("../models/user.model");

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Unauthorized"));
    }

    const decoded = await admin.auth().verifyIdToken(token);

    const user = await User.findOne({ firebaseUid: decoded.uid });
    if (!user) {
      return next(new Error("User not found in database"));
    }

    socket.user = user;
    next();
  } catch (err) {
    console.error("Socket Auth Error:", err.message);
    next(new Error("Invalid token"));
  }
};

module.exports = socketAuth;