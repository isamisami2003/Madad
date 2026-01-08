const mongoose = require('mongoose');
const Chat = require('../../models/chat.model.js');
const Message = require('../../models/message.model.js');

const getAllChats = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const chats = await Chat.aggregate([
      { $match: { participants: userId } },

      {
        $lookup: {
          from: "messages",
          let: { chatId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$chatId", "$$chatId"] },
                    { $not: { $in: [userId, "$deletedFor"] } }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "lastMessage"
        }
      },

      {
        $lookup: {
          from: "consultation_requests",
          localField: "consultationRequestId",
          foreignField: "_id",
          as: "consultation"
        }
      },
      { $unwind: { path: "$consultation", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "users",
          let: { participants: "$participants" },
          pipeline: [
            { $match: { $expr: { $and: [{ $in: ["$_id", "$$participants"] }, { $ne: ["$_id", userId] }] } } },
            { $project: { firstName: 1, lastName: 1, role: 1, profileImage: 1 } }
          ],
          as: "otherUser"
        }
      },
      { $unwind: { path: "$otherUser", preserveNullAndEmptyArrays: true } },

      {
        $addFields: {
          lastOpenedAtObj: {
            $filter: { input: "$lastOpenedAt", cond: { $eq: ["$$this.userId", userId] } }
          }
        }
      },
      {
        $addFields: {
          lastOpenedAt: {
            $cond: [
              { $gt: [{ $size: "$lastOpenedAtObj" }, 0] },
              { $arrayElemAt: ["$lastOpenedAtObj.openedAt", 0] },
              new Date(0)
            ]
          }
        }
      },

      {
        $lookup: {
          from: "messages",
          let: { chatId: "$_id", lastOpenedAt: "$lastOpenedAt" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$chatId", "$$chatId"] },
                    { $ne: ["$senderId", userId] },
                    { $not: { $in: [userId, "$deletedFor"] } },
                    { $gt: ["$createdAt", "$$lastOpenedAt"] }
                  ]
                }
              }
            },
            { $count: "unreadCount" }
          ],
          as: "unreadMessages"
        }
      },
      {
        $addFields: {
          unreadCount: {
            $cond: [
              { $gt: [{ $size: "$unreadMessages" }, 0] },
              { $arrayElemAt: ["$unreadMessages.unreadCount", 0] },
              0
            ]
          }
        }
      },

      {
        $project: {
          _id: 1,
          consultationTitle: "$consultation.title",
          consultationSpecialty: "$consultation.specialty",
          // لو بدك اسم واحد: otherUserFullName
          otherUserFullName: {
            $concat: [
              { $ifNull: ["$otherUser.firstName", ""] },
              { $cond: [{ $and: [{ $ifNull: ["$otherUser.firstName", false] }, { $ifNull: ["$otherUser.lastName", false] }] }, " ", ""] },
              { $ifNull: ["$otherUser.lastName", ""] }
            ]
          },
          otherUserRole: "$otherUser.role",
          otherUserImage: "$otherUser.profileImage",
          lastMessage: { $arrayElemAt: ["$lastMessage", 0] },
          unreadCount: 1
        }
      },

      { $sort: { "lastMessage.createdAt": -1 } }
    ]);

    res.status(200).json({ success: true, count: chats.length, data: chats });
  } catch (err) {
    console.error("Error in getAllChats:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = mongoose.Types.ObjectId(req.user._id);

    const chat = await Chat.findOne({ _id: chatId, participants: userId }).lean();
    if (!chat) return res.status(403).json({ message: "Access denied" });

    const skip = (page - 1) * limit;

    const messages = await Message.aggregate([
      { $match: { chatId: mongoose.Types.ObjectId(chatId), deletedFor: { $ne: userId } } },
      { $sort: { createdAt: 1 } },
      { $skip: skip },
      { $limit: Number(limit) },
      {
        $addFields: {
          isSenderUser: { $eq: ["$senderId", userId] }
        }
      },
      {
        $project: {
          deletedFor: 0
        }
      },
      {
        $addFields: {
          createdAtFormatted: {
            $dateToString: { format: "%Y-%m-%d %H:%M:%S", date: "$createdAt", timezone: "+03:00" }
          }
        }
      }
    ]).exec();

    const total = await Message.countDocuments({ chatId, deletedFor: { $ne: userId } });

    res.json({
      chat: { title: chat.title, specialty: chat.specialty },
      pagination: { currentPage: Number(page), limit: Number(limit), totalMessages: total },
      messages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const updateLastOpened = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;
    if (!chatId) return res.status(400).json({ message: 'Chat ID is required' });

    const now = new Date();

    let result = await Chat.updateOne(
      { _id: chatId, 'participants': userId, 'lastOpenedAt.userId': userId },
      { $set: { 'lastOpenedAt.$.openedAt': now } }
    );

    if (result.matchedCount > 0 && result.modifiedCount === 0) {
      await Chat.updateOne(
        { _id: chatId, participants: userId },
        { $push: { lastOpenedAt: { userId, openedAt: now } } }
      );
    }

    if (result.matchedCount === 0) {
      return res.status(403).json({ message: 'You are not part of this chat or chat not found' });
    }

    res.json({ message: 'Chat last opened time updated' });
  } catch (error) {
    console.error('Error updating last opened time:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const unreadMessagesCount = async (req, res) => {
  try {
    const userId = mongoose.Types.ObjectId(req.user._id);

    const chats = await Chat.find({ participants: userId }).select('_id lastOpenedAt').lean();

    const pipeline = [];

    const chatIds = chats.map(c => c._id);

    if (chatIds.length === 0) {
      return res.json({ totalUnread: 0 });
    }

    const matchConditions = chatIds.map(chatId => {
      const chat = chats.find(c => c._id.toString() === chatId.toString());
      const lastOpenedObj = chat.lastOpenedAt.find(r => r.userId.toString() === userId.toString());
      const lastOpenedAt = lastOpenedObj ? lastOpenedObj.openedAt : null;

      if (lastOpenedAt) {
        return {
          chatId,
          createdAt: { $gt: new Date(lastOpenedAt) }
        };
      } else {
        return { chatId };
      }
    });

    pipeline.push({
      $match: {
        senderId: { $ne: userId },
        deletedFor: { $ne: userId },
        $or: matchConditions
      }
    });

    pipeline.push({
      $group: {
        _id: "$chatId",
        count: { $sum: 1 }
      }
    });

    const counts = await Message.aggregate(pipeline);

    const totalUnread = counts.reduce((acc, curr) => acc + curr.count, 0);

    res.json({ totalUnread });

  } catch (error) {
    console.error('Error counting unread messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getChatStats = async (req, res) => {
  const userId = req.user._id;
  const { chatId } = req.params;

  const stats = await Message.aggregate([
    {
      $match: {
        chatId: new mongoose.Types.ObjectId(chatId),
        deletedFor: { $ne: userId }
      }
    },
    {
      $facet: {
        images: [{ $match: { type: "image" } }, { $count: "count" }],
        videos: [{ $match: { type: "video" } }, { $count: "count" }],
        files: [{ $match: { type: "file" } }, { $count: "count" }],
        links: [
          {
            $match: {
              type: "text",
              content: { $regex: /http/i }
            }
          },
          { $count: "count" }
        ],
        total: [{ $count: "count" }]
      }
    }
  ]);

  const counts = {
    images: stats[0].images[0]?.count || 0,
    videos: stats[0].videos[0]?.count || 0,
    files: stats[0].files[0]?.count || 0,
    links: stats[0].links[0]?.count || 0,
    total: stats[0].total[0]?.count || 0,
  };

  res.json({ counts });
};

const getMediaByChatId = async (req, res) => {
  try {
    const userId = req.user._id; // ✅ كان ناقص
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const media = await Message.find({
      chatId: mongoose.Types.ObjectId(chatId),
      type: { $in: ['image', 'video'] }, // ✅ بدل contentType
      deletedFor: { $ne: userId }
    }).sort({ createdAt: -1 });

    const imageCount = media.filter(msg => msg.type === 'image').length;
    const videoCount = media.filter(msg => msg.type === 'video').length;

    res.json({
      imageCount,
      videoCount,
      total: media.length,
      media
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


const getLinksByChatId = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const chatObjectId = mongoose.Types.ObjectId(chatId);

    const links = await Message.find({
      chatId: chatObjectId,
      type: 'text',
      deletedFor: { $ne: userId },
      content: { $regex: /(http[s]?:\/\/[^\s]+)/i }
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      linkCount: links.length,
      links
    });

  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getDocumentsByChatId = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const documents = await Message.find({
      chatId: mongoose.Types.ObjectId(chatId),
      type: 'file',
      deletedFor: { $ne: userId }
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      total: documents.length,
      documents
    });
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getConsultationSummary = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid consultation ID' });
    }

    const consultation = await Consultation.findById(id)
      .select('title createdAt status doctor')
      .populate('doctor', 'name specialization');

    if (!consultation) {
      return res.status(404).json({ message: 'Consultation not found' });
    }

    res.json(consultation);
  } catch (error) {
    console.error('getConsultationSummary Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const searchChats = async (req, res) => {
  try {
    const userId = mongoose.Types.ObjectId(req.user._id);
    const query = req.query.q?.trim().toLowerCase();

    if (!query) {
      return res.status(400).json({ message: 'يرجى إدخال نص للبحث.' });
    }

    const chats = await Chat.aggregate([
      { $match: { participants: userId } },
      {
        $lookup: {
          from: "users",
          let: { participants: "$participants" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$_id", "$$participants"] },
                    { $ne: ["$_id", userId] }
                  ]
                }
              }
            },
            { $project: { name: 1, role: 1, profileImage: 1 } }
          ],
          as: "otherUser"
        }
      },
      { $unwind: "$otherUser" },

      {
        $lookup: {
          from: "consultations",
          localField: "consultationRequestId",
          foreignField: "_id",
          as: "consultation"
        }
      },
      { $unwind: { path: "$consultation", preserveNullAndEmptyArrays: true } },

      {
        $match: {
          $or: [
            { "otherUser.name": { $regex: query, $options: "i" } },
            { "consultation.title": { $regex: query, $options: "i" } }
          ]
        }
      },

      {
        $lookup: {
          from: "messages",
          let: { chatId: "$_id", userId: userId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$chatId", "$$chatId"] },
                    { $not: { $in: ["$$userId", "$deletedFor"] } }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "lastMessage"
        }
      },
      { $addFields: { lastMessage: { $arrayElemAt: ["$lastMessage", 0] } } },

      {
        $project: {
          _id: 1,
          chatId: "$_id",
          otherUserName: "$otherUser.name",
          otherUserRole: "$otherUser.role",
          otherUserImage: "$otherUser.profileImage",
          consultationTitle: "$consultation.title",
          lastMessageContent: "$lastMessage.content",
          lastMessageTime: "$lastMessage.createdAt"
        }
      },
      { $sort: { lastMessageTime: -1 } }
    ]);

    res.json({ results: chats });

  } catch (err) {
    console.error('Error in chat search:', err);
    res.status(500).json({ message: 'حدث خطأ في البحث.' });
  }
};

const searchMessages = async (req, res) => {
  try {
    const userId = mongoose.Types.ObjectId(req.user._id);
    const { chatId, query, limit = 25, page = 1 } = req.query;

    if (!chatId || !query) {
      return res.status(400).json({ error: 'chatId and query are required' });
    }

    const chatObjectId = mongoose.Types.ObjectId(chatId);

    const chat = await Chat.findOne({
      _id: chatObjectId,
      participants: userId
    }).lean();

    if (!chat) {
      return res.status(403).json({ error: 'Access denied to this chat' });
    }

    const skip = (Number(page) - 1) * Number(limit);

    const messages = await Message.find({
      chatId: chatObjectId,
      content: { $regex: query, $options: 'i' },
      deletedFor: { $ne: userId }
    })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      results: messages,
      count: messages.length,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getAllChats,
  updateLastOpened,
  getChatMessages,
  unreadMessagesCount,
  getChatStats,
  getMediaByChatId,
  getLinksByChatId,
  getDocumentsByChatId,
  getConsultationSummary,
  searchChats,
  searchMessages

};
