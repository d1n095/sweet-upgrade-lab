// Shared CORS helper with origin allowlist.
//
// Browsers send an Origin header on cross-origin calls. We only echo back
// origins that match our allowlist; everything else gets a non-matching value
// which the browser will refuse. Non-browser callers (server-to-server,
// pg_net cron jobs, Stripe webhooks) typically don't send an Origin header at
// all — for those we fall back to a permissive default so they keep working.
//
// Usage in an edge function:
//
//   import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
//
//   const cors = buildCorsHeaders(req);
//   const pre = handleCorsPreflight(req, cors);
//   if (pre) return pre;
//   // ... return new Response(body, { headers: { ...cors, "Content-Type": "application/json" } });

const ALLOWED_ORIGINS: ReadonlyArray<string | RegExp> = [
  "https://4thepeople.se",
  "https://www.4thepeople.se",
  "https://sweet-upgrade-lab.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  // Lovable preview/published subdomains (id-preview--*, *.lovable.app)
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/id-preview--[a-z0-9-]+\.lovable\.app$/,
];

const DEFAULT_ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-cron-secret, x-secret";

function isAllowedOrigin(origin: string): boolean {
  for (const rule of ALLOWED_ORIGINS) {
    if (typeof rule === "string") {
      if (rule === origin) return true;
    } else if (rule.test(origin)) {
      return true;
    }
  }
  return false;
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  // No Origin header => non-browser caller (cron, server-to-server). Don't
  // bother sending CORS headers; they'll be ignored.
  if (!origin) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
      "Vary": "Origin",
    };
  }
  if (isAllowedOrigin(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin",
    };
  }
  // Disallowed origin: send a clearly non-matching value. Browser will block.
  return {
    "Access-Control-Allow-Origin": "null",
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
    "Vary": "Origin",
  };
}

export function handleCorsPreflight(
  req: Request,
  cors: Record<string, string>,
): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: cors });
}

/** Convenience: returns true when the caller's Origin is in the allowlist
 *  (or no Origin is set, which means a trusted server-to-server caller). */
export function originIsTrusted(req: Request): boolean {
  const origin = req.headers.get("Origin");
  if (!origin) return true;
  return isAllowedOrigin(origin);
}
