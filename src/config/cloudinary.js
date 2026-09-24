const { v2: cloudinary } = require("cloudinary");

// The Cloudinary SDK reads CLOUDINARY_URL automatically. Only apply the
// separate variables when all three are present, so missing values cannot
// overwrite credentials already parsed from CLOUDINARY_URL.
const individualCredentials = [
  process.env.CLOUDINARY_CLOUD_NAME,
  process.env.CLOUDINARY_API_KEY,
  process.env.CLOUDINARY_API_SECRET,
];
const hasIndividualCredentials = individualCredentials.every((value) => value?.trim());

if (hasIndividualCredentials) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
  });
}

cloudinary.assertConfigured = () => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  const placeholders = ["your_cloud_name", "your_cloudinary_api_key", "your_cloudinary_api_secret"];
  const values = [cloud_name, api_key, api_secret];
  const missing = ["cloud_name", "api_key", "api_secret"].filter((_, index) => !values[index]?.toString().trim());
  const hasPlaceholder = values
    .some((value) => placeholders.includes(value?.trim().toLowerCase()));

  if (missing.length || hasPlaceholder) {
    const details = missing.length ? `Missing: ${missing.join(", ")}` : "Replace the placeholder Cloudinary credentials with real credentials";
    const error = new Error(`Image uploads are unavailable. ${details}. Set CLOUDINARY_URL or all three CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET values.`);
    error.status = 503;
    throw error;
  }
};

module.exports = cloudinary;
