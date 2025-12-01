const onlineUsers = new Map();
const Chat = require('./models/chat.model.js');        
const Message = require('./models/message.model.js');

function setupSocket(io) {
 io.on('connection', async (socket) => {
  const userId = socket.user.id;
  onlineUsers.set(userId, socket.id);

  try {
    const chats = await Chat.find({ participants: userId });

    chats.forEach(chat => socket.join(chat._id.toString()));

    socket.on('check_online_status', ({ userIdToCheck }) => {
      const isOnline = onlineUsers.has(userIdToCheck);
      socket.emit('online_status', { userId: userIdToCheck, isOnline });
    });
  } catch (error) {
    console.error('Error during connection setup:', error);
  }

  socket.on('send_message', async ({ chatId, senderId, type, content }) => {
    if (senderId !== userId) return socket.emit('error', 'Unauthorized senderId');
    const message = new Message({ chatId, senderId, type, content, createdAt: new Date() });
    await message.save();
    io.to(chatId).emit('new_message', message);

    const chat = await Chat.findById(chatId).lean();
    const recipientId = chat.participants.find(p => p.toString() !== senderId);

    if (onlineUsers.has(recipientId.toString())) {
      io.to(onlineUsers.get(recipientId.toString())).emit('unread_message', { chatId });
    }
  });

  socket.on('typing', ({ chatId }) => {
    socket.to(chatId).emit('typing', { userId });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
  });
});
}

module.exports = setupSocket;