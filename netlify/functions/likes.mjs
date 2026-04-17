import { getStore } from "@netlify/blobs";

export default async (req) => {
  const store = getStore("palette-likes");
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method === "GET") {
    const data = await store.get("shared-likes", { type: "json" });
    return new Response(JSON.stringify(data || []), { headers });
  }

  if (req.method === "POST") {
    const body = await req.json();
    const idx = body.palette;

    const current = (await store.get("shared-likes", { type: "json" })) || [];
    const set = new Set(current);

    if (body.action === "like") set.add(idx);
    else set.delete(idx);

    const updated = [...set].sort((a, b) => a - b);
    await store.setJSON("shared-likes", updated);
    return new Response(JSON.stringify(updated), { headers });
  }

  return new Response("Method not allowed", { status: 405, headers });
};

export const config = { path: "/api/likes" };
