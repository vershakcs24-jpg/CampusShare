const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Wishlist = require('../models/Wishlist');
const Message = require('../models/Message');
const cloudinary = require('../config/cloudinary');
const asyncHandler = require('../utils/asyncHandler');

const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
        res.status(200).json({ success: true, data: user });
    } else {
        res.status(404).json({ success: false, message: "User not found" });
    }
});

const updateUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    ['name', 'branch', 'year', 'phone', 'hostel', 'bio'].forEach((field) => {
        if (req.body[field] !== undefined) user[field] = req.body[field];
    });

    if (req.file) {
        const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        const uploadResponse = await cloudinary.uploader.upload(fileBase64, {
            folder: 'campusshare_avatars',
            transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto:good', fetch_format: 'auto' }]
        });

        if (user.avatarCloudinaryId) {
            cloudinary.uploader.destroy(user.avatarCloudinaryId).catch(() => {});
        }
        user.avatar = uploadResponse.secure_url;
        user.avatarCloudinaryId = uploadResponse.public_id;
    } else if (req.body.avatar !== undefined) {
        user.avatar = req.body.avatar;
    }

    const updatedUser = await user.save();
    res.status(200).json({
        success: true,
        message: "Profile updated successfully!",
        data: {
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            branch: updatedUser.branch,
            year: updatedUser.year,
            phone: updatedUser.phone,
            hostel: updatedUser.hostel,
            bio: updatedUser.bio,
            avatar: updatedUser.avatar
        }
    });
});

const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (user && (await bcrypt.compare(oldPassword, user.password))) {
        user.password = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
        await user.save();
        res.status(200).json({ success: true, message: "Password changed successfully!" });
    } else {
        res.status(400).json({ success: false, message: "Incorrect current password." });
    }
});

const getUserStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const [listed, sold, wishlist, messageCount] = await Promise.all([
        Product.countDocuments({ seller: userId }),
        Product.countDocuments({ seller: userId, availability: 'Sold' }),
        Wishlist.findOne({ user: userId }),
        Message.countDocuments({ $or: [{ sender: userId }, { receiver: userId }] })
    ]);

    res.status(200).json({
        success: true,
        data: { listed, sold, wishlist: wishlist ? wishlist.products.length : 0, messages: messageCount }
    });
});

module.exports = { getUserProfile, updateUserProfile, changePassword, getUserStats };
