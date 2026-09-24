const express = require("express");

const {
  getUser,
  updateProfile,
  updateCover,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  searchUsers,
  discoverUsers,
} = require("../controllers/userController");

const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/search", protect, searchUsers);
router.get("/discover", protect, discoverUsers);
router.get("/suggestions", protect, async (req, res, next) => {
  try {
    const User = require("../models/User");
    const users = await User.find({ _id: { $ne: req.user._id, $nin: req.user.following } })
      .select("name username avatar bio followers following")
      .sort({ createdAt: -1 })
      .limit(3);
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", getUser);

router.get("/:id/followers", getFollowers);

router.get("/:id/following", getFollowing);

router.put(
  "/profile",
  protect,
  upload.fields([{ name: "avatar", maxCount: 1 }, { name: "cover", maxCount: 1 }]),
  updateProfile
);

router.put(
  "/cover",
  protect,
  upload.single("cover"),
  updateCover
);

router.post("/:id/follow", protect, followUser);

router.delete("/:id/follow", protect, unfollowUser);

module.exports = router;
