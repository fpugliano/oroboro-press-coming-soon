# Oroboro Press: coming-soon page

The temporary page at **https://oroboropress.com** (English) and **/it/** (Italian), until the full site
(`~/Documents/oroboro-press-site`, preview at anteprima.oroboropress.com) launches.

Plain HTML in `docs/`, served by GitHub Pages. Edit `docs/index.html` and `docs/it/index.html` together, then commit and push.

## The "Notify me" form

The form sends the address to a small Cloudflare Worker (`signup/`, live at https://oroboro-signup.fpugliano.workers.dev),
which saves it in the Cloudflare D1 database `oroboro-signups` (columns: email, lang, list, created_at).

See who signed up:

    cd signup && npx wrangler d1 execute oroboro-signups --remote --command "SELECT * FROM signups ORDER BY created_at"

Export as CSV for MailerLite/Buttondown: add `--json` and convert, or ask Claude.
Change the Worker: edit `signup/src/index.js`, then `cd signup && npx wrangler deploy`.

## At launch

1. In this repo: GitHub → Settings → Pages → remove the custom domain (or delete `docs/CNAME`), then archive the repo.
2. In oroboro-press-site: follow "Going live on oroboropress.com" in its README.
