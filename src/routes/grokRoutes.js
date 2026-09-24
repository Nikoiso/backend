const express = require("express");
const protect = require("../middleware/authMiddleware");
const { askGemini } = require("../controllers/grokController");

const router = express.Router();
router.post("/", protect, askGemini);
module.exports = router;
