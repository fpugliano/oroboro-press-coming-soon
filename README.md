# Oroboro Press: coming-soon page

The temporary page at **https://oroboropress.com** (English) and **/it/** (Italian), until the full site
(`~/Documents/oroboro-press-site`, preview at anteprima.oroboropress.com) launches.

Plain HTML in `docs/`, served by GitHub Pages. Edit `docs/index.html` and `docs/it/index.html` together, then commit and push.

## The "Notify me" form

The form posts to a small Cloudflare Worker (`signup/`, https://oroboro-signup.fpugliano.workers.dev). It:

1. keeps a backup copy in the Cloudflare D1 database `oroboro-signups`;
2. asks **Brevo** (free plan, account "Oroboro Press") to send the double opt-in email:
   template 1 = Italian, 2 = English (sources in `signup/emails/`), sender info@oroboropress.com;
3. Brevo adds the address to the list **Crumbs** (id 3, contact field LANGUAGE = it/en) only after the reader clicks
   "Confermo"/"Confirm", then sends them to `/it/grazie/` or `/thanks/`.

A weekly cron call (Mondays) keeps the Brevo API key from expiring after 90 days of inactivity.
The key is the Worker secret `BREVO_KEY` (replace with `npx wrangler secret put BREVO_KEY` in `signup/`).

Confirmed subscribers: Brevo → Contacts → Lists → Crumbs. Everyone who filled in the form (confirmed or not):

    cd signup && npx wrangler d1 execute oroboro-signups --remote --command "SELECT * FROM signups ORDER BY created_at"

Free plan limit: 300 emails a day, so a launch email to a bigger list goes out over several days.

## At launch

1. In this repo: GitHub → Settings → Pages → remove the custom domain (or delete `docs/CNAME`), then archive the repo.
2. In oroboro-press-site: follow "Going live on oroboropress.com" in its README.
