const nodemailer = require("nodemailer");

const createMailer = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
    const error = new Error("Password-reset email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM.");
    error.status = 503;
    throw error;
  }

  if (!Number.isFinite(Number(SMTP_PORT))) {
    const error = new Error("SMTP_PORT must be a valid port number.");
    error.status = 503;
    throw error;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
};

const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  const transporter = createMailer();
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Reset your X Clone password",
    text: `Hi ${name},\n\nReset your password using this link: ${resetUrl}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
    html: `<p>Hi ${escapeHtml(name)},</p><p>Use the button below to choose a new password. This link expires in one hour.</p><p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
};

const escapeHtml = (value) => String(value).replace(/[&<>\"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '\"': "&quot;",
  "'": "&#39;",
}[character]));

module.exports = { sendPasswordResetEmail };
