const express = require('express');
const router = express.Router();
const { sendMessage, getChatHistory, getConversations } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); 

router.get('/', getConversations);
router.post('/', sendMessage);
router.get('/:userId', getChatHistory);

module.exports = router;
