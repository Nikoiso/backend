const express = require("express");

const {
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
} = require("../controllers/postController");

const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/search", protect, searchPosts);
router.get("/bookmarks", protect, getBookmarks);
router.get("/history", protect, getHistory);
router.post("/:id/bookmark", protect, toggleBookmark);
router.post("/:id/view", protect, recordView);
router.get("/following", protect, getFollowingPosts);
router.get("/user/:id", getUserPosts);

router.get("/", getPosts);

router.get("/:id", getPost);

router.get("/:id/replies", getReplies);

router.post(
  "/",
  protect,
  upload.single("image"),
  createPost
);

router.delete("/:id", protect, deletePost);

router.post("/:id/like", protect, likePost);

router.post("/:id/repost", protect, repostPost);

module.exports = router;
