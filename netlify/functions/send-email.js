// netlify/functions/send-email.js
const nodemailer = require("nodemailer");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const { to, subject, text } = JSON.parse(event.body || "{}");
    if (!to || !subject || !text) return json(400, { error: "Missing fields" });

    const {
      SMTP_HOST, SMTP_PORT, SMTP_SECURE,
      SMTP_USER, SMTP_PASS, FROM_EMAIL, REPLY_TO
    } = process.env;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: String(SMTP_SECURE) === "true",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: FROM_EMAIL,
      to, subject, text,
      replyTo: REPLY_TO || FROM_EMAIL,
    });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

function json(status, body) {
  return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}