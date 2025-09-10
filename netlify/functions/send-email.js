// netlify/functions/send-email.js
import nodemailer from "nodemailer";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), { status: 405 });
  }

  try {
    const { to, subject, body, threadId } = await req.json();

    // ✅ Only require to, subject, and body
    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ ok: false, error: "Missing fields" }), { status: 400 });
    }

    // Build transporter from env vars
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: !!process.env.SMTP_SECURE,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Add a thread tag only if provided
    const threadTag = threadId ? `[t:${threadId}]` : "";
    const finalSubject = threadTag ? `${subject} ${threadTag}` : subject;

    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to,
      subject: finalSubject,
      text: body,
      headers: threadId ? { "X-Thread-Id": threadId } : {},
      replyTo: process.env.REPLY_TO || process.env.FROM_EMAIL,
    });

    return new Response(JSON.stringify({ ok: true, messageId: info.messageId }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};