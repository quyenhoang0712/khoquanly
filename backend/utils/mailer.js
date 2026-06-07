const dns = require("dns");
const nodemailer = require("nodemailer");

const mailTimeoutEnv = Number(process.env.MAIL_TIMEOUT_MS || 30000);
const MAIL_TIMEOUT_MS = Math.min(Math.max(Number.isFinite(mailTimeoutEnv) ? mailTimeoutEnv : 30000, 5000), 30000);
const RESEND_API_URL = "https://api.resend.com/emails";

const mailProvider = () => String(process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : "smtp")).trim().toLowerCase();

const mailConfigStatus = () => {
  if (mailProvider() === "resend") {
    const missing = ["RESEND_API_KEY", "MAIL_FROM"].filter((key) => !String(process.env[key] || "").trim());
    return {
      configured: missing.length === 0,
      missing,
      provider: "resend",
    };
  }

  const requiredKeys = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"];
  const missing = requiredKeys.filter((key) => !String(process.env[key] || "").trim());
  return {
    configured: missing.length === 0,
    missing,
    provider: "smtp",
  };
};

const resolveSmtpHost = async (host) => {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { host, servername: host };

  const addresses = await dns.promises.resolve4(host);
  if (!addresses.length) {
    const error = new Error(`Không tìm thấy IPv4 cho SMTP host ${host}`);
    error.code = "SMTP_IPV4_NOT_FOUND";
    throw error;
  }

  return { host: addresses[0], servername: host };
};

const createTransporter = async () => {
  const smtpHost = String(process.env.SMTP_HOST || "").trim();
  const resolved = await resolveSmtpHost(smtpHost);
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: resolved.host,
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
    tls: {
      servername: resolved.servername,
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
      setTimeout(() => reject(new Error("Gửi email quá thời gian chờ. Vui lòng kiểm tra cấu hình email.")), timeoutMs);
    }),
  ]);

const sendWithResend = async ({ from, to, subject, text, html }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAIL_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${String(process.env.RESEND_API_KEY || "").trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text, html }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.message || data.error || JSON.stringify(data) || `Resend API failed with status ${response.status}`;
      const error = new Error(message);
      error.code = `RESEND_${response.status}`;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Gửi email qua Resend quá thời gian chờ.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const sendEmployeeWelcomeEmail = async ({ to, name, password }) => {
  const status = mailConfigStatus();
  if (!status.configured) {
    return { sent: false, skipped: true, reason: `Thiếu cấu hình ${status.provider}: ${status.missing.join(", ")}` };
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

  if (status.provider === "resend") {
    const data = await sendWithResend({ from, to, subject, text, html });
    return { sent: true, skipped: false, provider: "resend", id: data.id };
  }

  const transporter = await createTransporter();
  await withTimeout(transporter.sendMail({ from, to, subject, text, html }), MAIL_TIMEOUT_MS);
  return { sent: true, skipped: false, provider: "smtp" };
};

module.exports = { sendEmployeeWelcomeEmail, mailConfigStatus };
