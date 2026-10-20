// "Notify me" signups from oroboropress.com.
// POST /  with JSON {email, lang, list} or a normal form post.
// Keeps a copy in D1, then asks Brevo to send the double opt-in email ("Confermo");
// Brevo adds the address to the Crumbs list only after the click.
// A weekly cron call keeps the Brevo API key from expiring through inactivity.
const BREVO = "https://api.brevo.com/v3";
const LIST_ID = 3;                                  // Brevo list "Crumbs"
const TEMPLATE = { it: 1, en: 2 };                  // Brevo DOI templates
const THANKS = { it: "https://oroboropress.com/it/grazie/", en: "https://oroboropress.com/thanks/" };
// http:// too, until GitHub's certificate is in place (and for visitors who type http://)
const ALLOWED = ["https://oroboropress.com", "https://www.oroboropress.com",
                 "http://oroboropress.com", "http://www.oroboropress.com",
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

    const res = await fetch(`${BREVO}/contacts/doubleOptinConfirmation`, {
      method: "POST",
      headers: { "api-key": env.BREVO_KEY, "Content-Type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        email, includeListIds: [LIST_ID], templateId: TEMPLATE[lang],
        redirectionUrl: THANKS[lang], attributes: { LANGUAGE: lang },
      }),
    });
    if (!res.ok) {
      console.error("brevo", res.status, await res.text());
      return new Response(JSON.stringify({ ok: false, error: "send_failed" }), { status: 502, headers });
    }
    return new Response(JSON.stringify({ ok: true }), { headers });
  },

  async scheduled(event, env) {
    const res = await fetch(`${BREVO}/account`, { headers: { "api-key": env.BREVO_KEY } });
    if (!res.ok) console.error("brevo keep-alive", res.status, await res.text());
  },
};
