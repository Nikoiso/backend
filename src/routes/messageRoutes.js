const express = require("express");

const {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  markMessageAsRead,
} = require("../controllers/messageController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/conversations", protect, getConversations);

router.post(
  "/conversation/:userId",
  protect,
  getOrCreateConversation
);

router.get(
  "/:conversationId",
  protect,
  getMessages
);

router.post(
  "/:conversationId",
  protect,
  sendMessage
);

router.put(
  "/read/:messageId",
  protect,
  markMessageAsRead
);

module.exports = router;