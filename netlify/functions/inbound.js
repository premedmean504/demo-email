// netlify/functions/inbound.js
import { getStore } from "@netlify/blobs";

function extractThreadId({ subject = "", headers = "" }) {
  // 1) Try X-Thread-Id header
  const matchHeader = headers.match(/x-thread-id:\s*([^\r\n]+)/i);
  if (matchHeader?.[1]) return matchHeader[1].trim();

  // 2) Try subject tag like "... [t:abc123] ..."
  const matchSubject = subject.match(/\[t:([a-z0-9_-]{6,})\]/i);
  if (matchSubject?.[1]) return matchSubject[1];

  return null;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    // Many providers post as form-encoded
    const contentType = req.headers.get("content-type") || "";
    let payload = {};
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      payload = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
    }

    const subject = payload.subject || "";
    const text = payload.text || payload["stripped-text"] || payload["TextBody"] || "";
    const headers = payload.headers || payload["message-headers"] || "";

    const threadId = extractThreadId({ subject, headers });
    if (!threadId) {
      console.warn("Inbound email missing threadId; subject:", subject);
      return new Response(JSON.stringify({ ok: false, error: "No thread id" }), { status: 200 });
    }

    const store = getStore({ name: "threads" });
    const key = `thread:${threadId}`;
    const existing = (await store.get(key, { type: "json" })) || [];

    existing.push({
      id: payload["Message-Id"] || payload["message-id"] || crypto.randomUUID(),
      role: "assistant",
      text: text || "(no body)",
      ts: new Date().toISOString(),
    });

    await store.setJSON(key, existing);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};