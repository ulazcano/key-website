import { getStore } from "@netlify/blobs";
import crypto from "crypto";

export default async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const { email, password } = await req.json();

    const adminEmail = Netlify.env.get("ADMIN_EMAIL");
    const adminPassword = Netlify.env.get("ADMIN_PASSWORD");

    if (!email || !password || email !== adminEmail || password !== adminPassword) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers,
      });
    }

    const token = crypto.randomUUID();
    const store = getStore("admin-sessions");
    await store.setJSON(token, { email, created: Date.now() });

    return new Response(JSON.stringify({ token }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers,
    });
  }
};

export const config = { path: "/api/auth" };
