// netlify/functions/inbound.js
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  try {
    // Capture raw request body
    const raw = await req.text();

    // 1) Print full body to logs (best seen with Netlify CLI)
    console.log("==== RAW INBOUND START ====");
    console.log(raw);
    console.log("==== RAW INBOUND END ====");

    // 2) Save to Netlify Blobs so you can download in Dashboard
    const store = await getStore("inbound-dumps"); // namespace
    const key = `gmail-forwarding-${Date.now()}.txt`;
    await store.set(key, raw);

    console.log("Saved inbound dump to blobs key:", key);

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error processing inbound:", err);
    return new Response("ERROR", { status: 500 });
  }
};