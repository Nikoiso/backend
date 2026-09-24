const User = require("../models/User");
const mongoose = require("mongoose");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const Notification = require("../models/Notification");

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    try { cloudinary.assertConfigured(); } catch (error) { reject(error); return; }
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "x-clone",
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const getUser = async (req, res) => {
  try {
    const identifier = req.params.id;
    if (!mongoose.isValidObjectId(identifier) && !/^[a-zA-Z0-9_]{1,30}$/.test(identifier)) return res.status(400).json({ message: "Invalid user identifier" });
    const user = await User.findOne(
      mongoose.isValidObjectId(identifier)
        ? { $or: [{ _id: identifier }, { username: identifier.toLowerCase() }] }
        : { username: identifier.toLowerCase() }
    )
      .select("-password")
      .populate("followers", "name username avatar")
      .populate("following", "name username avatar");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, username, bio } = req.body;
    const avatarFile = req.files?.avatar?.[0];
    const coverFile = req.files?.cover?.[0];
    if (name !== undefined && (typeof name !== "string" || !name.trim() || name.trim().length > 50)) return res.status(400).json({ message: "Name must contain 1–50 characters" });
    if (bio !== undefined && (typeof bio !== "string" || bio.length > 160)) return res.status(400).json({ message: "Bio cannot exceed 160 characters" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name !== undefined) {
      user.name = name;
    }

    if (bio !== undefined) {
      user.bio = bio;
    }

    if (username !== undefined) {
      if (typeof username !== "string") return res.status(400).json({ message: "Username must be text" });
      const normalized = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{1,15}$/.test(normalized)) {
        return res.status(400).json({ message: "Username must use 1–15 letters, numbers, or underscores" });
      }
      const existing = await User.findOne({ username: normalized, _id: { $ne: user._id } });
      if (existing) return res.status(409).json({ message: "Username is already taken" });
      user.username = normalized;
    }

    if (avatarFile) {
      const result = await uploadToCloudinary(avatarFile.buffer);
      user.avatar = result.secure_url;
    }
    if (coverFile) {
      const result = await uploadToCloudinary(coverFile.buffer);
      user.coverImage = result.secure_url;
    }

    await user.save();

    res.json({
      message: "Profile updated",
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
        coverImage: user.coverImage,
        followers: user.followers,
        following: user.following,
      },
    });
  } catch (error) {
    console.error("Profile update failed:", error);
    res.status(error.status || 502).json({ message: error.message || "Could not save your profile" });
  }
};

const updateCover = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Image is required",
      });
    }

    const result = await uploadToCloudinary(req.file.buffer);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        coverImage: result.secure_url,
      },
      {
        new: true,
      }
    ).select("-password");

    res.json({
      message: "Cover image updated",
      user,
    });
  } catch (error) {
    console.error("Cover image update failed:", error);
    res.status(error.status || 502).json({ message: error.message || "Could not upload the cover image" });
  }
};

const followUser = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid user ID" });
    const targetUser = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (targetUser._id.equals(currentUser._id)) {
      return res.status(400).json({
        message: "You cannot follow yourself",
      });
    }

    if (currentUser.following.some((id) => id.equals(targetUser._id))) {
      return res.json({ message: "Already following this user", following: true });
    }

    currentUser.following.push(targetUser._id);
    targetUser.followers.push(currentUser._id);

    await currentUser.save();
    await targetUser.save();

    await Notification.create({
      recipient: targetUser._id,
      sender: currentUser._id,
      type: "follow",
    });

    const io = req.app.get("io");
    if (io) {
      const notification = await Notification.findOne({ recipient: targetUser._id, sender: currentUser._id, type: "follow" }).populate("sender", "name username avatar").sort({ createdAt: -1 });
      io.to(targetUser._id.toString()).emit("notification", notification);
    }

    res.json({
      message: "User followed",
      following: true,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const unfollowUser = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid user ID" });
    const targetUser = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    currentUser.following = currentUser.following.filter(
      (id) => !id.equals(targetUser._id)
    );

    targetUser.followers = targetUser.followers.filter(
      (id) => !id.equals(currentUser._id)
    );

    await currentUser.save();
    await targetUser.save();

    res.json({
      message: "User unfollowed",
      following: false,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getFollowers = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("followers", "name username avatar bio");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user.followers);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("following", "name username avatar bio");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json(user.following);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const searchUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    if (!q) return res.json([]);
    const safeQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const users = await User.find({
      $or: [
        {
          name: {
            $regex: safeQuery,
            $options: "i",
          },
        },
        {
          username: {
            $regex: safeQuery,
            $options: "i",
          },
        },
      ],
    })
      .select("-password")
      .limit(20);

    const currentUserId = req.user._id.toString();
    res.json(users.filter((user) => user._id.toString() !== currentUserId));
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const discoverUsers = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const filters = { _id: { $ne: req.user._id } };
    const users = await User.find(filters)
      .select("name username avatar bio followers following")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await User.countDocuments(filters);
    res.json({ users, page, hasMore: page * limit < total });
  } catch (error) {
    res.status(500).json({ message: error.message || "Unable to discover users" });
  }
};

module.exports = {
  getUser,
  updateProfile,
  updateCover,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  searchUsers,
  discoverUsers,
};
