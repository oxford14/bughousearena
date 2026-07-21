import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifyAuthRequest } from "@/lib/server/verify-auth";
import { isSuperAdminEmail } from "@/lib/admin/super-admins";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { uid, email } = await verifyAuthRequest(request);
    const limited = await enforceApiRateLimits(request, { uid });
    if (limited) return limited;

    const decoded = await getAdminAuth().verifyIdToken(
      request.headers.get("Authorization")!.slice(7)
    );

    const superAdmin =
      Boolean(decoded.superAdmin) || isSuperAdminEmail(decoded.email ?? email);
    const admin = Boolean(decoded.admin) || superAdmin;

    return NextResponse.json({ superAdmin, admin });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve role.";
    const status = message === "Must be signed in." ? 401 : 500;
    return NextResponse.json(
      { superAdmin: false, admin: false, error: message },
      { status }
    );
  }
}
