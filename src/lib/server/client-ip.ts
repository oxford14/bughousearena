/**
 * Best-effort client IP behind Firebase Hosting / reverse proxies.
 * Uses the leftmost X-Forwarded-For hop (original client) when present.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);

  return "unknown";
}
