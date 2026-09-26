const deployedFrontendOrigins = [
  "https://frontend-tawny-rho-74.vercel.app",
];

const vercelOrgPattern = /^https:\/\/frontend(-[a-z0-9-]+)?-68b3\.vercel\.app$/;

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
  if (!origin) return callback(null, true);

  const normalizedOrigin = origin.replace(/\/+$/, "");
  const allowedOrigins = getAllowedOrigins();

  const isAllowed =
    allowedOrigins.includes(normalizedOrigin) ||
    vercelOrgPattern.test(normalizedOrigin);

  if (isAllowed) {
    return callback(null, true);
  }

  console.warn(`CORS blocked origin: ${origin}. Configured origins: ${allowedOrigins.join(", ")}`);
  return callback(null, false);
};

module.exports = corsOrigin;