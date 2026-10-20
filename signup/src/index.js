// "Notify me" signups from oroboropress.com.
// POST /  with JSON {email, lang, list} or a normal form post.
// Keeps a copy in D1, then asks Brevo to send the double opt-in email ("Confermo");
// Brevo adds the address to the Crumbs list only after the click.
// Every Monday a cron run emails Francesco a summary of the week's confirmed subscribers
// (only when there are new ones); the same call keeps the Brevo key from expiring.
const OWNER = { email: "fpugliano@gmail.com", name: "Francesco" };
const SENDER = { email: "info@oroboropress.com", name: "Oroboro Press" };
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
    await weeklySummary(env);
  },
};

const LANG_NAME = { it: "Italian", en: "English" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Confirmed subscribers come from the Brevo list; "not confirmed yet" from the D1 backup.
async function weeklySummary(env) {
  const brevo = (path, init = {}) => fetch(`${BREVO}${path}`,
    { ...init, headers: { "api-key": env.BREVO_KEY, "accept": "application/json", "Content-Type": "application/json" } });

  const contacts = [];
  for (let offset = 0; ; offset += 500) {
    const res = await brevo(`/contacts/lists/${LIST_ID}/contacts?limit=500&offset=${offset}`);
    if (!res.ok) { console.error("brevo list", res.status, await res.text()); return; }
    const page = (await res.json()).contacts || [];
    contacts.push(...page);
    if (page.length < 500) break;
  }
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const fresh = contacts.filter((c) => Date.parse(c.createdAt) >= weekAgo)
                        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (!fresh.length) return;

  const confirmed = new Set(contacts.map((c) => c.email.toLowerCase()));
  const { results } = await env.DB.prepare(
    "SELECT email FROM signups WHERE created_at >= datetime('now', '-7 days')").all();
  const pending = results.filter((r) => !confirmed.has(r.email)).length;

  const n = fresh.length, total = contacts.length;
  const rows = fresh.map((c) => `<tr><td style="padding:6px 12px 6px 0">${esc(c.email)}</td>` +
    `<td style="padding:6px 12px 6px 0;color:#6E6E73">${LANG_NAME[c.attributes?.LANGUAGE] || "?"}</td>` +
    `<td style="padding:6px 0;color:#6E6E73">${c.createdAt.slice(0, 10)}</td></tr>`).join("");
  const html = `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1D1D1F;max-width:560px">
<p style="font-size:20px;font-weight:600;margin:0 0 4px">${n} new subscriber${n === 1 ? "" : "s"} this week</p>
<p style="margin:0 0 18px;color:#424245">${total} in total on the Crumbs list.${pending ? ` ${pending} more signed up this week but haven't clicked "Confermo" yet.` : ""}</p>
<table style="border-collapse:collapse;font-size:15px">${rows}</table>
<p style="margin:22px 0 0;font-size:13px;color:#6E6E73">Full list: Brevo → CRM → Contacts → Lists → Crumbs.</p></div>`;

  const res = await brevo("/smtp/email", { method: "POST", body: JSON.stringify({
    sender: SENDER, to: [OWNER],
    subject: `Crumbs: ${n} new subscriber${n === 1 ? "" : "s"} this week (${total} in total)`,
    htmlContent: html,
  }) });
  if (!res.ok) console.error("brevo summary", res.status, await res.text());
}
