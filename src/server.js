const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const http = require("http");

const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorMiddleware");
const setupSocket = require("./socket/socket");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const grokRoutes = require("./routes/grokRoutes");

const app = express();

const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    message: "X Clone API is running",
  });
});

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/posts", postRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/messages", messageRoutes);
app.use("/api/grok", grokRoutes);

const io = setupSocket(server);
app.set("io", io);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Socket.IO is ready");
  });
}).catch((error) => {
  console.error("Server startup aborted:", error.message);
  process.exitCode = 1;
});
