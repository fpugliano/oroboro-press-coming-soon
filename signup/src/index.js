// Stores "Notify me" signups from oroboropress.com in D1.
// POST /  with JSON {email, lang, list} or a normal form post.
const ALLOWED = ["https://oroboropress.com", "https://www.oroboropress.com",
                 "https://anteprima.oroboropress.com", "http://localhost:8765"];
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = { ...cors(origin), "Content-Type": "application/json" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return new Response(JSON.stringify({ ok: false }), { status: 405, headers });

    let data = {};
    const type = request.headers.get("Content-Type") || "";
    try {
      data = type.includes("application/json") ? await request.json()
           : Object.fromEntries(await request.formData());
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "bad_request" }), { status: 400, headers });
    }

    // honeypot field: real people leave it empty
    if (data.website) return new Response(JSON.stringify({ ok: true }), { headers });

    const email = String(data.email || "").trim().toLowerCase();
    if (!EMAIL.test(email)) return new Response(JSON.stringify({ ok: false, error: "invalid_email" }), { status: 400, headers });
    const lang = data.lang === "it" ? "it" : "en";
    const list = String(data.list || "crumbs").slice(0, 40);

    await env.DB.prepare("INSERT OR IGNORE INTO signups (email, lang, list) VALUES (?, ?, ?)")
      .bind(email, lang, list).run();
    return new Response(JSON.stringify({ ok: true }), { headers });
  },
};
