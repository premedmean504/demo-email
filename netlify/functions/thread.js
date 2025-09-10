// netlify/functions/thread.js
import { getStore } from "@netlify/blobs";

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response(JSON.stringify([]), { status: 200 });

  const store = getStore({ name: "threads" });
  const key = `thread:${id}`;
  const json = await store.get(key, { type: "json" });

  // The UI expects an array of items with { id, role, text, ts }
  return new Response(JSON.stringify(Array.isArray(json) ? json : []), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
};