// POST /api/contact
// Receives the contact form from internetcarpenter.com and emails it to Hudson through Resend.
//
// Settings (set on the Worker, never in this file):
//   RESEND_API_KEY    required  a Resend key with "Sending access" only
//   TURNSTILE_SECRET  optional  Cloudflare Turnstile secret; when set, every message must pass the check
//   CONTACT_TO        optional  where messages go (default below)
//   CONTACT_FROM      optional  a sender on a domain verified in Resend (default below)
// Binding (wrangler.jsonc): CONTACT_LIMIT, a per-visitor rate limiter.
//
// Layers, cheapest first: same-site check, per-visitor rate limit, hidden field and minimum
// fill time, field validation, Turnstile, then the send.

const DEFAULT_TO = "charlesprobaker@gmail.com";
const DEFAULT_FROM = "Internet Carpenter site <hello@longbow.fit>";
const MIN_FILL_MS = 2500; // a human takes longer than this to fill the form

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Strip control characters and cap the length. Header-bound fields also lose newlines.
function clean(value, max, singleLine) {
  let s = String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  if (singleLine) s = s.replace(/[\r\n]+/g, " ");
  return s.trim().slice(0, max);
}

function looksLikeEmail(email) {
  const at = email.indexOf("@");
  return at > 0 && email.indexOf(" ") < 0 && email.lastIndexOf(".") > at + 1 && email.lastIndexOf(".") < email.length - 1;
}

async function turnstilePassed(token, secret, ip) {
  const form = new URLSearchParams({ secret, response: String(token || "") });
  if (ip) form.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    if (!res.ok) return false;
    const out = await res.json();
    return out.success === true;
  } catch (e) {
    return false;
  }
}

export async function handleContact(request, env) {
  if (request.method !== "POST") return reply({ error: "Use POST." }, 405);

  // Only this site's own pages may post. Browsers always send Origin on a POST, so a missing one is refused.
  const origin = request.headers.get("origin");
  let sameSite = false;
  try { sameSite = !!origin && new URL(origin).host === new URL(request.url).host; } catch (e) { sameSite = false; }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!sameSite || (fetchSite && fetchSite !== "same-origin")) {
    return reply({ error: "Not allowed." }, 403);
  }

  // Per-visitor rate limit (a handful of tries a minute).
  const ip = request.headers.get("cf-connecting-ip") || "";
  if (env.CONTACT_LIMIT) {
    const { success } = await env.CONTACT_LIMIT.limit({ key: ip || "unknown" });
    if (!success) return reply({ error: "Too many tries. Please wait a minute and try again." }, 429);
  }

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return reply({ error: "That request was not readable." }, 400);
  }

  // Bots: a filled hidden field, or a form submitted faster than a person could. Pretend it worked.
  if (clean(data.website, 200, true) !== "" || !(Date.now() - Number(data.t) > MIN_FILL_MS)) {
    return reply({ ok: true });
  }

  const name = clean(data.name, 100, true);
  const email = clean(data.email, 200, true);
  const message = clean(data.message, 5000, false);

  if (!name || !looksLikeEmail(email) || message.length < 10) {
    return reply({ error: "Please add your name, a valid email, and a message." }, 400);
  }

  // Turnstile, when it is switched on for this Worker.
  if (env.TURNSTILE_SECRET && !(await turnstilePassed(data.token, env.TURNSTILE_SECRET, ip))) {
    return reply({ error: "The spam check did not pass. Please reload the page and try again." }, 400);
  }

  if (!env.RESEND_API_KEY) {
    console.error("contact: RESEND_API_KEY is not set");
    return reply({ error: "Messages are not switched on yet." }, 503);
  }

  const text = [
    "New inquiry from the Internet Carpenter contact form.",
    "",
    "Name:  " + name,
    "Email: " + email,
    "",
    message,
  ].join("\n");

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM || DEFAULT_FROM,
        to: [env.CONTACT_TO || DEFAULT_TO],
        reply_to: email,
        subject: "Internet Carpenter inquiry from " + name,
        text,
      }),
    });
  } catch (e) {
    console.error("contact: could not reach Resend");
    return reply({ error: "That did not go through." }, 502);
  }

  if (!res.ok) {
    console.error("contact: Resend answered " + res.status);
    return reply({ error: "That did not go through." }, 502);
  }
  return reply({ ok: true });
}
