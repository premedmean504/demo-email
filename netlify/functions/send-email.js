// netlify/functions/send-email.js
import nodemailer from "nodemailer";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405 }
    );
  }

  try {
    const { to, subject, body, threadId } = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
        { status: 400 }
      );
    }

    // ✅ Gmail SMTP transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com", // smtp.gmail.com
      port: Number(process.env.SMTP_PORT) || 587,      // 587 for STARTTLS
      secure: String(process.env.SMTP_SECURE) === "true", // false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      requireTLS: true, // forces STARTTLS on port 587
    });

    // Add thread ID to subject if provided
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

    return new Response(
      JSON.stringify({ ok: true, messageId: info.messageId }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500 }
    );
  }
};