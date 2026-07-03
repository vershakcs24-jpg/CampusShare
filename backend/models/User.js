const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        match: [/^[\w-\.]+@nitj\.ac\.in$/, 'Please use an official @nitj.ac.in email'] 
    },
    password: { type: String, required: true },
    branch: { type: String, default: "" },
    year: { type: String, default: "" },
    phone: { type: String, default: "" },
    hostel: { type: String, default: "" },
    bio: { type: String, default: "" },
    avatar: { type: String, default: "" },
    avatarCloudinaryId: { type: String, default: "" },
    resetPasswordToken: { type: String, default: undefined, select: false },
    resetPasswordExpire: { type: Date, default: undefined, select: false }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);