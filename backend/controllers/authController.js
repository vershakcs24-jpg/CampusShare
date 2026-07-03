const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const asyncHandler = require('../utils/asyncHandler');

const authPayload = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    branch: user.branch,
    year: user.year,
    token: generateToken(user._id)
});

const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, branch, year } = req.body;

    if (!email.endsWith('@nitj.ac.in')) {
        return res.status(400).json({ success: false, message: 'Access Denied. Only @nitj.ac.in emails allowed.' });
    }

    if (await User.findOne({ email })) {
        return res.status(400).json({ success: false, message: 'User already registered with this email.' });
    }

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const user = await User.create({ name, email, password: hashedPassword, branch: branch || "", year: year || "" });

    res.status(201).json({ success: true, message: 'Account created successfully!', data: authPayload(user) });
});

const authUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.password))) {
        res.status(200).json({ success: true, message: 'Logged in successfully!', data: authPayload(user) });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials or wrong password.' });
    }
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Please provide your registered email.' });
    }

    const user = await User.findOne({ email });
    const genericMessage = 'If an account exists for that email, a password reset link has been sent.';

    if (!user) {
        return res.status(200).json({ success: true, message: genericMessage });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${frontendUrl}/auth.html?resetToken=${rawToken}`;
    const message = `You requested a password reset for your CampusShare account.\n\nClick the link below to set a new password (valid for 30 minutes):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;

    try {
        await sendEmail({
            to: user.email,
            subject: 'CampusShare - Password Reset Request',
            text: message,
            html: `<p>You requested a password reset for your CampusShare account.</p><p><a href="${resetUrl}">Click here to set a new password</a> (valid for 30 minutes).</p><p>If you didn't request this, you can safely ignore this email.</p>`
        });
    } catch (emailErr) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        console.error('Failed to send password reset email:', emailErr.message);
        return res.status(500).json({ success: false, message: 'Could not send the reset email right now. Please try again later.' });
    }

    res.status(200).json({ success: true, message: genericMessage });
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: Date.now() }
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!user) {
        return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });
    }

    user.password = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successfully. You can now log in with your new password.' });
});

module.exports = { registerUser, authUser, forgotPassword, resetPassword };
