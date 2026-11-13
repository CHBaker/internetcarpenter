# internetcarpenter

Internet Carpenter LLC's contracting site, to be served at https://internetcarpenter.com. Plain static files, no build step.

Deployed by Cloudflare Workers Builds (static assets) connected to this repo: every push to `main` redeploys.
The site files live in `public/`; `wrangler.jsonc` points at them and attaches the custom domains.
Build settings in the dashboard: build command empty, deploy command `npx wrangler deploy`, root directory `/`. The Worker name must be `internetcarpenter`.

## The site (2026-11-13)

A one-page contractor site: application rescue, architecture and AI audits, team evaluation, and builds. The contact form posts to `/api/contact`, a Worker in `src/` (same code as chbdev.com, with this site's own sender and inbox defaults).

Settings on the Worker `internetcarpenter` (Hudson sets them; Claude never handles the values):
- `RESEND_API_KEY` (required, a Resend key with Sending access on longbow.fit). Until it is set the form answers "Messages are not switched on yet" and shows the direct email address.
- `TURNSTILE_SECRET` (optional). To turn the spam check on, also add this site's hostname to the Turnstile widget and add `<meta name="turnstile-sitekey" content="...">` to `public/index.html`. Set both together, or messages are refused.
- `CONTACT_TO` and `CONTACT_FROM` (optional). Default inbox: internetcarpenter@protonmail.com.

The form is also rate limited (3 a minute per visitor, `CONTACT_LIMIT` in `wrangler.jsonc`, namespace 1002).
