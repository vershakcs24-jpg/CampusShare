const Message = require('../models/Message');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const sendMessage = asyncHandler(async (req, res) => {
    const { receiverId, text, listingId } = req.body;
    const senderId = req.user._id;

    if (!text || !receiverId) {
        return res.status(400).json({ success: false, message: "Receiver ID and text are required" });
    }

    const message = await Message.create({ sender: senderId, receiver: receiverId, text, listingId: listingId || undefined });
    const populatedMessage = await message.populate('sender', 'name email avatar');

    res.status(201).json({ success: true, data: populatedMessage });
});

const getChatHistory = asyncHandler(async (req, res) => {
    const currentUserId = req.user._id;
    const chatPartnerId = req.params.userId;

    const messages = await Message.find({
        $or: [
            { sender: currentUserId, receiver: chatPartnerId },
            { sender: chatPartnerId, receiver: currentUserId }
        ]
    })
        .populate('sender', 'name email avatar')
        .populate('listingId', 'title price images')
        .sort({ createdAt: 1 });

    await Message.updateMany(
        { sender: chatPartnerId, receiver: currentUserId, read: false },
        { $set: { read: true } }
    );

    res.status(200).json({ success: true, count: messages.length, data: messages });
});

const getConversations = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const conversations = await Message.aggregate([
        { $match: { $or: [{ sender: userId }, { receiver: userId }] } },
        { $addFields: { partner: { $cond: [{ $eq: ['$sender', userId] }, '$receiver', '$sender'] } } },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: '$partner',
                lastMessage: { $first: '$text' },
                lastMessageAt: { $first: '$createdAt' },
                lastListingId: { $first: '$listingId' },
                unreadCount: {
                    $sum: { $cond: [{ $and: [{ $eq: ['$receiver', userId] }, { $eq: ['$read', false] }] }, 1, 0] }
                }
            }
        },
        { $sort: { lastMessageAt: -1 } }
    ]);

    const populated = await User.populate(conversations, { path: '_id', select: 'name email avatar branch year' });

    const data = populated
        .filter((c) => c._id)
        .map((c) => ({
            user: c._id,
            lastMessage: c.lastMessage,
            lastMessageAt: c.lastMessageAt,
            listingId: c.lastListingId,
            unreadCount: c.unreadCount
        }));

    res.status(200).json({ success: true, count: data.length, data });
});

module.exports = { sendMessage, getChatHistory, getConversations };
