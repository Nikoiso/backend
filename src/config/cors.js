const deployedFrontendOrigins = [
  "https://frontend-git-main-main-68b3.vercel.app",
  "https://frontend-main-68b3.vercel.app",
];

const getAllowedOrigins = () => {
  const origins = [process.env.CLIENT_URL, process.env.FRONTEND_URL]
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return [...new Set([
    ...deployedFrontendOrigins,
    ...origins,
    ...(origins.length ? [] : ["http://localhost:3000"]),
  ])];
};

const corsOrigin = (origin, callback) => {
  const allowedOrigins = getAllowedOrigins();
  const normalizedOrigin = origin?.replace(/\/+$/, "");

  if (!origin || allowedOrigins.includes(normalizedOrigin)) {
    return callback(null, true);
  }

  console.warn(`CORS blocked origin: ${origin}. Configured origins: ${allowedOrigins.join(", ")}`);
  return callback(null, false);
};

module.exports = corsOrigin;
