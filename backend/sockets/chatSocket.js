const Message = require('../models/Message');

const activeUsers = new Map();

const chatSocket = (io) => {
    io.on('connection', (socket) => {
        console.log(`🔌 New Socket Connection Established: ${socket.id}`);

      
        socket.on('register_user', (userId) => {
            if (!userId) return;
            socket.userId = userId;

            if (!activeUsers.has(userId)) {
                activeUsers.set(userId, new Set());
            }
            activeUsers.get(userId).add(socket.id);

           
            socket.join(userId);

            console.log(`👤 User ${userId} is now online (socket ${socket.id})`);
            io.emit('get_online_users', Array.from(activeUsers.keys()));
        });

      
        socket.on('send_private_message', async ({ senderId, receiverId, text, listingId, tempId }) => {
            if (!senderId || !receiverId || !text || !text.trim()) return;

          
            if (socket.userId && socket.userId !== senderId) {
                return socket.emit('message_error', { message: 'Not authorized to send as this user' });
            }

          
            const now = Date.now();
            socket._sendTimestamps = (socket._sendTimestamps || []).filter(t => now - t < 10000);
            if (socket._sendTimestamps.length >= 15) {
                return socket.emit('message_error', { message: 'You are sending messages too fast. Please slow down.' });
            }
            socket._sendTimestamps.push(now);

            const trimmed = text.trim().slice(0, 2000); 

            try {
                const saved = await Message.create({
                    sender: senderId,
                    receiver: receiverId,
                    text: trimmed,
                    listingId: listingId || undefined
                });

                const populated = await saved.populate('sender', 'name email avatar');

                const messagePayload = {
                    _id: populated._id,
                    sender: populated.sender,
                    senderId,
                    receiver: receiverId,
                    text: populated.text,
                    listingId: populated.listingId,
                    read: populated.read,
                    createdAt: populated.createdAt,
                    tempId: tempId || undefined
                };

              
                io.to(receiverId).emit('receive_private_message', messagePayload);
                io.to(senderId).emit('receive_private_message', messagePayload);

                const isReceiverOnline = activeUsers.has(receiverId);
                console.log(isReceiverOnline
                    ? `📩 Message delivered instantly to online user: ${receiverId}`
                    : `📥 Receiver offline. Message saved to database only.`);
            } catch (err) {
                console.error('❌ Failed to persist/send message:', err.message);
                socket.emit('message_error', { message: 'Failed to send message', tempId: tempId || undefined });
            }
        });

       
        socket.on('typing', ({ senderId, receiverId }) => {
            if (receiverId) io.to(receiverId).emit('user_typing', { senderId });
        });
        socket.on('stop_typing', ({ senderId, receiverId }) => {
            if (receiverId) io.to(receiverId).emit('user_stop_typing', { senderId });
        });

      
        socket.on('get_online_users', () => {
            socket.emit('get_online_users', Array.from(activeUsers.keys()));
        });

      
        socket.on('disconnect', () => {
            const { userId } = socket;
            if (userId && activeUsers.has(userId)) {
                const sockets = activeUsers.get(userId);
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    activeUsers.delete(userId);
                    console.log(`❌ User ${userId} logged off.`);
                }
            }
            io.emit('get_online_users', Array.from(activeUsers.keys()));
        });
    });
};

module.exports = chatSocket;
