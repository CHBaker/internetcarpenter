// internetcarpenter.com Worker. The site is static files in ./public; this adds one route.
// wrangler.jsonc sends only /api/* here (run_worker_first), so every other request is served
// straight from the static assets and never wakes this code.
import { handleContact } from "./contact.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/contact") return handleContact(request, env);
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Not found." }), {
        status: 404,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
