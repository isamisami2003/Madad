
const path = require('path');

const uploadChatFiles = async (req, res) => {
    try {
        if (!req.user || !req.user._id) return res.status(401).json({ error: 'Unauthenticated' });

        const files = req.files || [];
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Return relative stored paths in the same style as other controllers
        const saved = files.map(f => `/patientFiles/${f.filename}`);

        return res.status(201).json({ message: 'Files uploaded', files: saved });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error', details: err.message });
    }
};

module.exports = { uploadChatFiles };