const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again in a few minutes.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts. Please wait a few minutes before trying again.' }
});

module.exports = { apiLimiter, authLimiter };
