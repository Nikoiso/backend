const multer = require("multer");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_IMAGE_SIZE,
  },

  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      const error = new Error("Only image files are allowed");
      error.status = 400;
      cb(error);
    }
  },
});

upload.MAX_IMAGE_SIZE = MAX_IMAGE_SIZE;

module.exports = upload;
