const nodemailer = require("nodemailer");

const requiredKeys = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
const MAIL_TIMEOUT_MS = Number(process.env.MAIL_TIMEOUT_MS || 30000);

const mailConfigStatus = () => {
  const missing = requiredKeys.filter((key) => !String(process.env[key] || "").trim());
  return {
    configured: missing.length === 0,
    missing,
  };
};

const createTransporter = () => {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: String(process.env.SMTP_HOST || "").trim(),
    port,
    secure: port === 465,
    family: 4,
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
    auth: {
      user: String(process.env.SMTP_USER || "").trim(),
      pass: String(process.env.SMTP_PASS || "").replace(/\s+/g, ""),
    },
  });
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const withTimeout = (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Gửi email quá thời gian chờ. Vui lòng kiểm tra cấu hình SMTP.")), timeoutMs);
    }),
  ]);

const sendEmployeeWelcomeEmail = async ({ to, name, password }) => {
  const status = mailConfigStatus();
  if (!status.configured) {
    return { sent: false, skipped: true, reason: `Thiếu cấu hình SMTP: ${status.missing.join(", ")}` };
  }

  const appUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const subject = "Thông tin tài khoản nhân viên";
  const safeName = escapeHtml(name);
  const safeTo = escapeHtml(to);
  const safePassword = escapeHtml(password);
  const safeAppUrl = escapeHtml(appUrl);
  const text = [
    `Chào ${name},`,
    "",
    "Tài khoản nhân viên của bạn đã được tạo.",
    `Email đăng nhập: ${to}`,
    `Mật khẩu ban đầu: ${password}`,
    `Link đăng nhập: ${appUrl}`,
    "",
    "Vui lòng đăng nhập và đổi mật khẩu trong phần Hồ sơ.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>Chào <strong>${safeName}</strong>,</p>
      <p>Tài khoản nhân viên của bạn đã được tạo.</p>
      <p><strong>Email đăng nhập:</strong> ${safeTo}</p>
      <p><strong>Mật khẩu ban đầu:</strong> ${safePassword}</p>
      <p><strong>Link đăng nhập:</strong> <a href="${safeAppUrl}">${safeAppUrl}</a></p>
      <p>Vui lòng đăng nhập và đổi mật khẩu trong phần Hồ sơ.</p>
    </div>
  `;

  await withTimeout(createTransporter().sendMail({ from, to, subject, text, html }), MAIL_TIMEOUT_MS);
  return { sent: true, skipped: false };
};

module.exports = { sendEmployeeWelcomeEmail, mailConfigStatus };
