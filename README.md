# internetcarpenter

Internet Carpenter LLC's contracting site, to be served at https://internetcarpenter.com. Plain static files, no build step.

Deployed by Cloudflare Workers Builds (static assets) connected to this repo: every push to `main` redeploys.
The site files live in `public/`; `wrangler.jsonc` points at them and attaches the custom domains.
Build settings in the dashboard: build command empty, deploy command `npx wrangler deploy`, root directory `/`. The Worker name must be `internetcarpenter`.
