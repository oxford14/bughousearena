import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";
import { isSuperAdminEmail } from "@/lib/admin/super-admins";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await verifySuperAdminRequest(request);
    const { uid, banned } = (await request.json()) as {
      uid?: string;
      banned?: boolean;
    };

    if (!uid || typeof banned !== "boolean") {
      return NextResponse.json(
        { error: "uid and banned are required." },
        { status: 400 }
      );
    }

    const target = await getAdminAuth().getUser(uid);
    if (target.customClaims?.superAdmin || isSuperAdminEmail(target.email)) {
      return NextResponse.json(
        { error: "Cannot ban a super admin." },
        { status: 400 }
      );
    }

    await getAdminAuth().updateUser(uid, { disabled: banned });
    if (banned) {
      await getAdminAuth().revokeRefreshTokens(uid);
    }
    await getAdminDb().collection("users").doc(uid).update({ banned });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update ban status.";
    const status = message.includes("admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
