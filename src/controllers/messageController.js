const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");

const getOrCreateConversation = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;

    if (!mongoose.isValidObjectId(otherUserId)) return res.status(400).json({ message: "Invalid user ID" });
    if (!(await User.exists({ _id: otherUserId }))) return res.status(404).json({ message: "User not found" });

    if (currentUserId.equals(otherUserId)) {
      return res.status(400).json({
        message: "You cannot create a conversation with yourself",
      });
    }

    let conversation = await Conversation.findOne({
      participants: {
        $all: [currentUserId, otherUserId],
      },
    }).populate("participants", "name username avatar");

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, otherUserId],
      });

      conversation = await Conversation.findById(
        conversation._id
      ).populate("participants", "name username avatar");
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate("participants", "name username avatar")
      .sort({ updatedAt: -1 });

    const enriched = await Promise.all(conversations.map(async (conversation) => {
      const [unreadCount, lastMessage] = await Promise.all([
        Message.countDocuments({ conversation: conversation._id, sender: { $ne: req.user._id }, read: false }),
        Message.findOne({ conversation: conversation._id }).sort({ createdAt: -1 }).select("text createdAt sender"),
      ]);
      return { ...conversation.toObject(), unreadCount, lastMessage };
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getMessages = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.conversationId)) return res.status(400).json({ message: "Invalid conversation ID" });
    const conversation = await Conversation.findById(
      req.params.conversationId
    );

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some((id) =>
      id.equals(req.user._id)
    );

    if (!isParticipant) {
      return res.status(403).json({
        message: "You are not part of this conversation",
      });
    }

    const messages = await Message.find({
      conversation: req.params.conversationId,
    })
      .populate("sender", "name username avatar")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const sendMessage = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.conversationId)) return res.status(400).json({ message: "Invalid conversation ID" });
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        message: "Message cannot be empty",
      });
    }

    const conversation = await Conversation.findById(
      req.params.conversationId
    );

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some((id) =>
      id.equals(req.user._id)
    );

    if (!isParticipant) {
      return res.status(403).json({
        message: "You are not part of this conversation",
      });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      text: text.trim(),
    });

    await Conversation.findByIdAndUpdate(conversation._id, {
      updatedAt: new Date(),
    });

    const populatedMessage = await Message.findById(message._id).populate(
      "sender",
      "name username avatar"
    );

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const markMessageAsRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.messageId)) return res.status(400).json({ message: "Invalid message ID" });
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    const conversation = await Conversation.findById(
      message.conversation
    );

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some((id) =>
      id.equals(req.user._id)
    );

    if (!isParticipant) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    message.read = true;

    await message.save();

    res.json({
      message: "Message marked as read",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  markMessageAsRead,
};
