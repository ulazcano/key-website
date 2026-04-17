import { getStore } from "@netlify/blobs";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function slugify(text) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function authenticate(req) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "");
  const store = getStore("admin-sessions");
  const session = await store.get(token, { type: "json" });
  return !!session;
}

async function getAllProperties() {
  const store = getStore("propiedades");
  const data = await store.get("all", { type: "json" });
  return data || [];
}

async function saveAllProperties(properties) {
  const store = getStore("propiedades");
  await store.setJSON("all", properties);
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.replace(/^\/api\/propiedades\/?/, "").split("/").filter(Boolean);
  const id = pathParts[0] || null;

  // GET — public
  if (req.method === "GET") {
    const properties = await getAllProperties();
    if (id) {
      const prop = properties.find((p) => p.id === id);
      if (!prop) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
      }
      return new Response(JSON.stringify(prop), { headers });
    }
    return new Response(JSON.stringify(properties), { headers });
  }

  // All write operations require auth
  const authed = await authenticate(req);
  if (!authed) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  // POST — create
  if (req.method === "POST") {
    const body = await req.json();

    // Support bulk import (array)
    if (Array.isArray(body)) {
      await saveAllProperties(body);
      return new Response(JSON.stringify({ imported: body.length }), { status: 201, headers });
    }

    const properties = await getAllProperties();
    if (!body.id) {
      body.id = slugify(body.direccion || body.titulo || `prop-${Date.now()}`);
    }
    if (!body.slug) {
      body.slug = body.id;
    }

    // Ensure unique id
    let baseId = body.id;
    let counter = 1;
    while (properties.some((p) => p.id === body.id)) {
      body.id = `${baseId}-${counter}`;
      body.slug = body.id;
      counter++;
    }

    properties.push(body);
    await saveAllProperties(properties);
    return new Response(JSON.stringify(body), { status: 201, headers });
  }

  // PUT — update
  if (req.method === "PUT") {
    if (!id) {
      return new Response(JSON.stringify({ error: "ID required" }), { status: 400, headers });
    }
    const body = await req.json();
    const properties = await getAllProperties();
    const idx = properties.findIndex((p) => p.id === id);
    if (idx === -1) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
    }
    body.id = id;
    body.slug = id;
    properties[idx] = body;
    await saveAllProperties(properties);
    return new Response(JSON.stringify(body), { headers });
  }

  // DELETE
  if (req.method === "DELETE") {
    if (!id) {
      return new Response(JSON.stringify({ error: "ID required" }), { status: 400, headers });
    }
    const properties = await getAllProperties();
    const idx = properties.findIndex((p) => p.id === id);
    if (idx === -1) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
    }
    properties.splice(idx, 1);
    await saveAllProperties(properties);
    return new Response(JSON.stringify({ deleted: id }), { headers });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
};

export const config = { path: "/api/propiedades/*" };
