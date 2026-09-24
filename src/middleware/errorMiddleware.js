const errorHandler = (err, req, res, next) => {
  console.error(`${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);

  const statusCode = err.status || (err.name === "MulterError" || err.code === "LIMIT_FILE_SIZE" ? 400 : 500);
  const message = err.code === "LIMIT_FILE_SIZE"
    ? "Images must be 5 MB or smaller"
    : err.message || "Server error";

  res.status(statusCode).json({ message });
};
  
  module.exports = errorHandler;
