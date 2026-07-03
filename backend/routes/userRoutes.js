const express = require('express');
const router = express.Router();
const { getUserProfile, updateUserProfile, changePassword, getUserStats } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.route('/profile')
    .get(getUserProfile)
    .put(upload.single('avatar'), updateUserProfile);

router.put('/change-password', changePassword);
router.get('/stats', getUserStats);

module.exports = router;