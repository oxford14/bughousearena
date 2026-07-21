import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";
import { isSuperAdminEmail } from "@/lib/admin/super-admins";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid: adminUid } = await verifySuperAdminRequest(request);
    const limited = await enforceApiRateLimits(request, {
      uid: adminUid,
      tier: "admin",
    });
    if (limited) return limited;

    const { uid, admin } = (await request.json()) as {
      uid?: string;
      admin?: boolean;
    };

    if (!uid || typeof admin !== "boolean") {
      return NextResponse.json(
        { error: "uid and admin are required." },
        { status: 400 }
      );
    }

    const target = await getAdminAuth().getUser(uid);
    const isSuper =
      Boolean(target.customClaims?.superAdmin) || isSuperAdminEmail(target.email);
    if (isSuper && !admin) {
      return NextResponse.json(
        { error: "Cannot demote a super admin." },
        { status: 400 }
      );
    }

    await getAdminAuth().setCustomUserClaims(uid, {
      ...(target.customClaims ?? {}),
      admin,
    });
    await getAdminAuth().revokeRefreshTokens(uid);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update role.";
    const status = message.includes("admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
