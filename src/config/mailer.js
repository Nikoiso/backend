const nodemailer = require("nodemailer");

const createMailer = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
    throw new Error("Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM.");
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
  });
};

module.exports = { sendPasswordResetEmail };
