const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  consultationRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultationRequest', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastOpenedAt: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    openedAt: { type: Date, default: null }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema, 'chats');