// ── Ad-hoc in-memory rate limiter (per edge function instance) ──
// NOTE: Edge function instances are ephemeral and not shared. This catches
// obvious bursts within a single instance but is NOT a distributed limiter.

type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 10_000;
const LIMIT = 10;

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
}

/**
 * Check if request from this IP exceeds 10 requests / 10s.
 * If exceeded, inserts a security_events row (type=api, severity=high).
 * Returns true if rate limited (caller should reject), false if allowed.
 */
export async function checkRateLimit(
  supabase: any,
  req: Request,
  endpoint: string,
  userId: string | null = null,
): Promise<boolean> {
  const ip = getClientIp(req);
  const key = `${ip}::${endpoint}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }

  bucket.count += 1;

  if (bucket.count > LIMIT) {
    // Log once per window crossing (avoid spamming)
    if (bucket.count === LIMIT + 1) {
      try {
        await supabase.from("security_events").insert({
          type: "api",
          severity: "high",
          message: "Possible spam / brute force",
          endpoint,
          user_id: userId,
          ip,
        });
      } catch (e) {
        console.error("[rateLimit] failed to insert security_event:", (e as Error).message);
      }
    }
    return true;
  }

  return false;
}
