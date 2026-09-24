const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Notification = require("../models/Notification");
const corsOrigin = require("../config/cors");

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const user = await User.findById(decoded.id).select(
        "-password"
      );

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.user = user;

      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.username}`);

    socket.join(socket.user._id.toString());

    socket.on("joinConversation", async (conversationId) => {
      try {
        const conversation = await Conversation.findById(
          conversationId
        );

        if (!conversation) {
          return;
        }

        const isParticipant = conversation.participants.some(
          (id) => id.equals(socket.user._id)
        );

        if (!isParticipant) {
          return;
        }

        socket.join(conversationId);

        console.log(
          `${socket.user.username} joined conversation ${conversationId}`
        );
      } catch (error) {
        console.error(error.message);
      }
    });

    socket.on("sendMessage", async (data) => {
      try {
        const {
          conversationId,
          text,
        } = data;

        if (!conversationId || !text?.trim()) {
          return;
        }

        const conversation = await Conversation.findById(
          conversationId
        );

        if (!conversation) {
          return;
        }

        const isParticipant = conversation.participants.some(
          (id) => id.equals(socket.user._id)
        );

        if (!isParticipant) {
          return;
        }

        const message = await Message.create({
          conversation: conversationId,
          sender: socket.user._id,
          text: text.trim(),
        });

        await Conversation.findByIdAndUpdate(
          conversationId,
          {
            updatedAt: new Date(),
          }
        );

        const populatedMessage =
          await Message.findById(message._id).populate(
            "sender",
            "name username avatar"
          );

        io.to(conversationId).emit(
          "newMessage",
          populatedMessage
        );

        for (const participantId of conversation.participants) {
          if (participantId.equals(socket.user._id)) continue;
          const notification = await Notification.create({
            recipient: participantId,
            sender: socket.user._id,
            type: "message",
            message: message._id,
          });
          io.to(participantId.toString()).emit("notification", {
            ...notification.toObject(),
            sender: populatedMessage.sender,
          });
          io.to(participantId.toString()).emit("messageNotification", populatedMessage);
        }
      } catch (error) {
        console.error(
          "Send message error:",
          error.message
        );
      }
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.user.username}`);
    });

    socket.on("typing", (conversationId) => {
      socket.to(conversationId).emit(
        "userTyping",
        {
          userId: socket.user._id,
          username: socket.user.username,
        }
      );
    });

    socket.on("stopTyping", (conversationId) => {
      socket.to(conversationId).emit(
        "userStoppedTyping",
        {
          userId: socket.user._id,
        }
      );
    });

  });

  return io;
};

module.exports = setupSocket;
