import {
  isAllowedAuthHost,
  PRODUCTION_APP_ORIGIN,
} from "@/lib/app-config";

/**
 * Resolve a safe app origin for PayMongo redirect/callback URLs.
 * Only allowlisted hosts are accepted; otherwise fall back to production.
 */
export function getSafeAppOrigin(request: Request): string {
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    try {
      const url = new URL(originHeader);
      if (isAllowedAuthHost(url.hostname)) {
        return url.origin;
      }
    } catch {
      /* ignore invalid origin */
    }
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      const url = new URL(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""));
      if (isAllowedAuthHost(url.hostname)) {
        return url.origin;
      }
    } catch {
      /* ignore */
    }
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_ORIGIN;
  }

  return "http://localhost:3000";
}
