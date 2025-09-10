// netlify/functions/inbound.js
import { getStore } from "@netlify/blobs";

// Small helpers
const firstEmail = (v = "") => {
  // Extract first email from "Name <email@host>" or comma-separated lists
  const parts = String(v).split(",")[0].trim();
  const m = parts.match(/<([^>]+)>/);
  return (m ? m[1] : parts).toLowerCase();
};

const nowIso = () => new Date().toISOString();

export default async (req) => {
  try {
    // 1) Parse payload (SendGrid posts either JSON or form-data)
    let payload = null;
    let contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      payload = Object.fromEntries([...form.entries()]);
      // Some SendGrid fields inside form-data can be JSON strings; attempt to parse known ones
      for (const k of ["headers", "dkim", "spam_report", "envelope", "charsets", "spf"]) {
        if (payload[k] && typeof payload[k] === "string") {
          try { payload[k] = JSON.parse(payload[k]); } catch {/* keep as string */}
        }
      }
    } else {
      // Fallback: try JSON, else read text
      try { payload = await req.json(); }
      catch { payload = { raw: await req.text() }; }
    }

    // 2) Normalize common fields
    const from = payload.from || (payload.headers?.from) || "";
    const to = payload.to || (payload.headers?.to) || "";
    const subject = payload.subject || (payload.headers?.subject) || "";
    const text = payload.text || payload["text/plain"] || "";
    const html = payload.html || payload["text/html"] || "";
    const headers = payload.headers || {};

    // 3) Pick a thread key
    //    Strategy: use the first "to" address (e.g., reply@inbound.lat).
    //    If missing, fall back to subject; if still missing, use "misc".
    let threadKey = firstEmail(to);
    if (!threadKey) {
      const s = String(subject || "").trim().toLowerCase().replace(/\s+/g, "-").slice(0, 64);
      threadKey = s || "misc";
    }

    // 4) Shape the message we store
    const message = {
      receivedAt: nowIso(),
      from,
      to,
      subject,
      text,
      html,
      headers,
      // Raw envelope/SPF/DKIM if present (not required)
      dkim: payload.dkim ?? null,
      spf: payload.spf ?? null,
      envelope: payload.envelope ?? null,
      spam_report: payload.spam_report ?? null,
    };

    // 5) Save to Netlify Blobs
    const store = await getStore("threads-store"); // namespace; appears in Netlify → Storage → Blobs
    const key = `threads/${threadKey}/${Date.now()}.json`;
    await store.set(key, JSON.stringify(message));

    // 6) Light logging (safe)
    console.log(`[inbound] saved ${key} from=${firstEmail(from)} subject="${subject}"`);

    return new Response(JSON.stringify({ ok: true, key, thread: threadKey }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Inbound error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};