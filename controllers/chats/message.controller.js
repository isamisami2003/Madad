const mongoose = require('mongoose');
const Message = require("../../models/message.model");
const Chat = require("../../models/chat.model");

const deleteMessageForOne = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    const chat = await Chat.findById(message.chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    if (!chat.participants.some(id => id.toString() === userId.toString())) {
      return res.status(403).json({ error: "You are not a participant in this chat" });
    }

    if (!message.deletedFor.some(id => id.toString() === userId.toString())) {
      message.deletedFor.push(userId);
      await message.save();
    }

    // تنظيف تلقائي للسجل إذا كل المشاركين حذفوه لأنفسهم (اختياري ومفيد)
    const allDeleted = chat.participants.every(pid =>
      message.deletedFor.some(did => did.toString() === pid.toString())
    );
    if (allDeleted) {
      await Message.findByIdAndDelete(messageId);
    }

    return res.status(200).json({ status: "deleted_for_me", messageId: message._id });
  } catch (error) {
    console.error("deleteMessageForOne error:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

const deleteAllMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: "Invalid chat ID" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    if (!chat.participants.some(id => id.toString() === userId.toString())) {
      return res.status(403).json({ error: "You are not a participant in this chat" });
    }

    const messages = await Message.find({ chatId });

    const bulkOps = [];
    for (const msg of messages) {
      // علّم الرسالة كمحذوفة للمستخدم الحالي
      if (!msg.deletedFor.some(id => id.toString() === userId.toString())) {
        bulkOps.push({
          updateOne: { filter: { _id: msg._id }, update: { $push: { deletedFor: userId } } }
        });
      }

      // تنظيف تلقائي إذا صارت محذوفة لكل المشاركين
      const allDeleted = chat.participants.every(pid =>
        msg.deletedFor.map(did => did.toString()).includes(pid.toString()) ||
        pid.toString() === userId.toString()
      );
      if (allDeleted) {
        bulkOps.push({ deleteOne: { filter: { _id: msg._id } } });
      }
    }

    if (bulkOps.length > 0) await Message.bulkWrite(bulkOps, { ordered: false });

    return res.status(200).json({ status: "all_deleted_for_me", chatId });
  } catch (error) {
    console.error("deleteAllMessages error:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};

module.exports = {
  deleteMessageForOne,
  deleteAllMessages
};