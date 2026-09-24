const Notification = require("../models/Notification");
const mongoose = require("mongoose");

const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id,
    })
      .populate("sender", "name username avatar")
      .populate("post", "text image")
      .populate("message", "text conversation")
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const markAsRead = async (req, res) => {
  try {
    if (req.params.id && !mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid notification ID" });
    if (req.params.id) {
      const notification = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { read: true }, { new: true });
      if (!notification) return res.status(404).json({ message: "Notification not found" });
    } else {
      await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
    }

    res.json({
      message: "Notifications marked as read",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
};
