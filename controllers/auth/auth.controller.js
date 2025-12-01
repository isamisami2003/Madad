const admin = require('../../src/firebase');
const User = require('../../models/user.model');

const loginUser = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token provided' });

        const decoded = await admin.auth().verifyIdToken(token);
        const { uid, phone_number: phone } = decoded;

        let user = await User.findOne({ $or: [{ uid }, { phone }] });

        if (user) {
            return res.status(200).json({
                message: 'login successfully',
            });
        }

        const { role } = req.body;

        if (!['doctor', 'patient'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be "doctor" or "patient"' });
        }

        user = await User.create({ phone, role, firebaseUid: uid });


        return res.status(201).json({
            message: 'User created successfully',
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Invalid or expired token', details: err.message });
    }
};

module.exports = { loginUser };