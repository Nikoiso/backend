const Post = require("../models/Post");
const Notification = require("../models/Notification");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const User = require("../models/User");
const mongoose = require("mongoose");

const emitNotification = async (req, notification) => {
  const io = req.app.get("io");
  if (!io) return;
  const populated = await Notification.findById(notification._id)
    .populate("sender", "name username avatar")
    .populate("post", "text image");
  io.to(notification.recipient.toString()).emit("notification", populated);
};

const withReplyCounts = async (posts) => {
  if (!posts.length) return [];
  const replyCounts = await Post.aggregate([
    { $match: { parentPost: { $in: posts.map((post) => post._id) } } },
    { $group: { _id: "$parentPost", count: { $sum: 1 } } },
  ]);
  const byId = new Map(replyCounts.map(({ _id, count }) => [_id.toString(), count]));
  return posts.map((post) => ({ ...(typeof post.toObject === "function" ? post.toObject() : post), replies: { length: byId.get(post._id.toString()) || 0 } }));
};

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    try { cloudinary.assertConfigured(); } catch (error) { reject(error); return; }
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "x-clone/posts",
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

const createPost = async (req, res) => {
  try {
    const { text, parentPost } = req.body;

    if (text !== undefined && typeof text !== "string") return res.status(400).json({ message: "Post text must be a string" });
    if (parentPost && !mongoose.isValidObjectId(parentPost)) return res.status(400).json({ message: "Invalid parent post ID" });

    if (!text && !req.file) {
      return res.status(400).json({
        message: "Post must contain text or image",
      });
    }

    if (text && text.length > 280) {
      return res.status(400).json({
        message: "Post cannot exceed 280 characters",
      });
    }

    let image = "";

    if (parentPost && !(await Post.exists({ _id: parentPost }))) return res.status(404).json({ message: "Parent post not found" });

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);

      image = result.secure_url;
    }

    const post = await Post.create({
      text: text || "",
      image,
      author: req.user._id,
      parentPost: parentPost || null,
    });

    const populatedPost = await Post.findById(post._id).populate(
      "author",
      "name username avatar"
    );

    if (parentPost) {
      const parent = await Post.findById(parentPost);

      if (parent && !parent.author.equals(req.user._id)) {
        const notification = await Notification.create({
          recipient: parent.author,
          sender: req.user._id,
          type: "reply",
          post: post._id,
        });
        await emitNotification(req, notification);
      }
    }

    res.status(201).json(populatedPost);
  } catch (error) {
    console.error("Post creation failed:", error);
    res.status(error.status || 502).json({ message: error.message || "Could not upload the post image" });
  }
};

const getPosts = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find({
      parentPost: null,
    })
      .populate("author", "name username avatar")
      .populate("likes", "name username avatar")
      .populate("reposts", "name username avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ page, posts: await withReplyCounts(posts) });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getFollowingPosts = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 20;
    const User = require("../models/User");
    const currentUser = await User.findById(req.user._id).select("following");
    const posts = await Post.find({ author: { $in: currentUser.following }, parentPost: null })
      .populate("author", "name username avatar")
      .populate("likes", "name username avatar")
      .populate("reposts", "name username avatar")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ page, posts: await withReplyCounts(posts) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPost = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid post ID" });
    const post = await Post.findById(req.params.id)
      .populate("author", "name username avatar")
      .populate("likes", "name username avatar")
      .populate("reposts", "name username avatar");

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const deletePost = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid post ID" });
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    if (!post.author.equals(req.user._id)) {
      return res.status(403).json({
        message: "You can only delete your own posts",
      });
    }

    await Post.findByIdAndDelete(req.params.id);
    await Notification.deleteMany({ post: req.params.id });

    await Post.deleteMany({
      parentPost: req.params.id,
    });

    res.json({
      message: "Post deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const likePost = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid post ID" });
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    const alreadyLiked = post.likes.some((id) =>
      id.equals(req.user._id)
    );

    if (alreadyLiked) {
      post.likes = post.likes.filter(
        (id) => !id.equals(req.user._id)
      );

      await post.save();

      return res.json({
        message: "Post unliked",
        liked: false,
        likesCount: post.likes.length,
      });
    }

    post.likes.push(req.user._id);

    await post.save();

    if (!post.author.equals(req.user._id)) {
      const notification = await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        type: "like",
        post: post._id,
      });
      await emitNotification(req, notification);
    }

    res.json({
      message: "Post liked",
      liked: true,
      likesCount: post.likes.length,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const repostPost = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid post ID" });
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    const alreadyReposted = post.reposts.some((id) =>
      id.equals(req.user._id)
    );

    if (alreadyReposted) {
      post.reposts = post.reposts.filter(
        (id) => !id.equals(req.user._id)
      );

      await post.save();

      return res.json({
        message: "Repost removed",
        reposted: false,
        repostsCount: post.reposts.length,
      });
    }

    post.reposts.push(req.user._id);

    await post.save();

    if (!post.author.equals(req.user._id)) {
      const notification = await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        type: "repost",
        post: post._id,
      });
      await emitNotification(req, notification);
    }

    res.json({
      message: "Post reposted",
      reposted: true,
      repostsCount: post.reposts.length,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getReplies = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid post ID" });
    const replies = await Post.find({
      parentPost: req.params.id,
    })
      .populate("author", "name username avatar")
      .sort({ createdAt: 1 });

    res.json(replies);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getUserPosts = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid user ID" });
    const tab = req.query.tab || "posts";
    if (!["posts", "likes", "replies"].includes(tab)) return res.status(400).json({ message: "Invalid profile tab" });
    const filter = tab === "likes"
      ? { likes: req.params.id, parentPost: null }
      : tab === "replies"
        ? { author: req.params.id, parentPost: { $ne: null } }
        : { author: req.params.id, parentPost: null };
    const posts = await Post.find(filter)
      .populate("author", "name username avatar")
      .populate("likes", "name username avatar")
      .populate("reposts", "name username avatar")
      .sort({ createdAt: -1 });

    res.json(await withReplyCounts(posts));
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const toggleBookmark = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid post ID" });
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    const exists = post.bookmarks.some((id) => id.equals(req.user._id));
    if (exists) post.bookmarks.pull(req.user._id);
    else post.bookmarks.addToSet(req.user._id);
    await post.save();
    return res.json({ bookmarked: !exists, bookmarksCount: post.bookmarks.length });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to update bookmark" });
  }
};

const getBookmarks = async (req, res) => {
  try {
    const posts = await Post.find({ bookmarks: req.user._id, parentPost: null })
      .populate("author", "name username avatar")
      .populate("likes", "name username avatar")
      .populate("reposts", "name username avatar")
      .sort({ updatedAt: -1 });
    return res.json(await withReplyCounts(posts));
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load bookmarks" });
  }
};

const recordView = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid post ID" });
    const post = await Post.findById(req.params.id).select("_id");
    if (!post) return res.status(404).json({ message: "Post not found" });
    await User.updateOne(
      { _id: req.user._id },
      [
        { $set: { history: { $filter: { input: { $ifNull: ["$history", []] }, as: "entry", cond: { $ne: ["$$entry.post", post._id] } } } } },
        { $set: { history: { $slice: [{ $concatArrays: [[{ post: post._id, viewedAt: new Date() }], "$history"] }, 100] } } },
      ]
    );
    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to record post view" });
  }
};

const getHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("history").populate({
      path: "history.post",
      populate: [
        { path: "author", select: "name username avatar" },
        { path: "likes", select: "name username avatar" },
        { path: "reposts", select: "name username avatar" },
      ],
    });
    const history = (user?.history || []).filter((entry) => entry.post).map((entry) => ({ ...entry.post.toObject(), viewedAt: entry.viewedAt }));
    return res.json(await withReplyCounts(history));
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load history" });
  }
};

const searchPosts = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    if (!q) return res.json([]);
    const safeQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const posts = await Post.find({
      text: {
        $regex: safeQuery,
        $options: "i",
      },
    })
      .populate("author", "name username avatar")
      .populate("likes", "name username avatar")
      .populate("reposts", "name username avatar")
      .sort({ createdAt: -1 })
      .limit(30);

    res.json(await withReplyCounts(posts));
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  createPost,
  getPosts,
  getFollowingPosts,
  getPost,
  deletePost,
  likePost,
  repostPost,
  getReplies,
  getUserPosts,
  searchPosts,
  toggleBookmark,
  getBookmarks,
  recordView,
  getHistory,
};
