const mongoose = require('mongoose');
const admin = require('../src/firebase');
const User = require('../models/user.model');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);

    const user = await User.findOne({ firebaseUid: decoded.uid });

    if (!user) {
      return res.status(403).json({ error: 'User not found in database' });
    }

    if (!mongoose.Types.ObjectId.isValid(user._id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    req.user = user;
    next();

  } catch (err) {
    console.error('Auth Error:', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = auth;
