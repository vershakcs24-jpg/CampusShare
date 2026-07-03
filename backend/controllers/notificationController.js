const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');

const getNotifications = asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ receiver: req.user._id })
        .populate('sender', 'name')
        .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: notifications.length, data: notifications });
});

const markAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    if (notification.receiver.toString() !== req.user._id.toString()) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ success: true, message: 'Notification marked as read' });
});

module.exports = { getNotifications, markAsRead };
