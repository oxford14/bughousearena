import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getClientIp } from "@/lib/server/client-ip";
import {
  RATE_LIMIT_TIERS,
  type RateLimitTier,
} from "@/lib/server/rate-limit-presets";

type RateLimitResult = {
  ok: boolean;
  retryAfterSec: number;
};

function docIdForKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 40);
}

/**
 * Fixed-window counter stored in Firestore `rateLimits/{hash}`.
 * Safe across multiple server instances; Admin SDK only.
 */
export async function enforceRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowMs } = params;
  const db = getAdminDb();
  const ref = db.collection("rateLimits").doc(docIdForKey(key));
  const now = Date.now();

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() as
        | { count?: number; windowStart?: number }
        | undefined;

      let windowStart = data?.windowStart ?? now;
      let count = data?.count ?? 0;

      if (now - windowStart >= windowMs) {
        windowStart = now;
        count = 0;
      }

      if (count >= limit) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((windowStart + windowMs - now) / 1000)
        );
        return { ok: false, retryAfterSec };
      }

      tx.set(
        ref,
        {
          key,
          count: count + 1,
          windowStart,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return { ok: true, retryAfterSec: 0 };
    });
  } catch (error) {
    // Fail open on transient Firestore errors so payments/auth keep working.
    console.error("[rate-limit] enforce failed; allowing request", error);
    return { ok: true, retryAfterSec: 0 };
  }
}

function tooManyRequestsResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}

/**
 * Applies global IP limit plus optional named tier limits (uid and/or IP).
 * Returns a 429 NextResponse when blocked, otherwise null.
 */
export async function enforceApiRateLimits(
  request: Request,
  options?: {
    uid?: string;
    tier?: RateLimitTier;
  }
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const tier = options?.tier;
  const uid = options?.uid;

  // Webhook uses its own IP tier only (no global bucket shared with user APIs).
  if (tier === "webhook") {
    const preset = RATE_LIMIT_TIERS.webhook;
    const result = await enforceRateLimit({
      key: `webhook:ip:${ip}`,
      limit: preset.ipLimit!,
      windowMs: preset.windowMs,
    });
    if (!result.ok) return tooManyRequestsResponse(result.retryAfterSec);
    return null;
  }

  const global = RATE_LIMIT_TIERS.globalIp;
  const globalResult = await enforceRateLimit({
    key: `global:ip:${ip}`,
    limit: global.ipLimit!,
    windowMs: global.windowMs,
  });
  if (!globalResult.ok) {
    return tooManyRequestsResponse(globalResult.retryAfterSec);
  }

  if (!tier) return null;

  const preset = RATE_LIMIT_TIERS[tier];

  if (preset.uidLimit != null && uid) {
    const uidResult = await enforceRateLimit({
      key: `${tier}:uid:${uid}`,
      limit: preset.uidLimit,
      windowMs: preset.windowMs,
    });
    if (!uidResult.ok) {
      return tooManyRequestsResponse(uidResult.retryAfterSec);
    }
  }

  if (preset.ipLimit != null) {
    const ipResult = await enforceRateLimit({
      key: `${tier}:ip:${ip}`,
      limit: preset.ipLimit,
      windowMs: preset.windowMs,
    });
    if (!ipResult.ok) {
      return tooManyRequestsResponse(ipResult.retryAfterSec);
    }
  }

  return null;
}
