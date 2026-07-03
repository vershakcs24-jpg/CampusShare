const express = require('express');
const router = express.Router();
const { registerUser, authUser, forgotPassword, resetPassword } = require('../controllers/authController');


router.post('/signup', registerUser);
router.post('/login', authUser);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

module.exports = router;