import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";
import type { AdminWithdrawal } from "@/lib/admin/admin-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await verifySuperAdminRequest(request);
    const db = getAdminDb();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "pending";

    const base = db.collection("redemptionRequests");
    const snap =
      status === "all"
        ? await base.orderBy("createdAt", "desc").limit(100).get()
        : await base
            .where("status", "==", status)
            .orderBy("createdAt", "desc")
            .limit(100)
            .get();

    const uids = Array.from(
      new Set(snap.docs.map((d) => d.data().uid as string).filter(Boolean))
    );
    const userMap = new Map<string, { displayName: string; email: string | null }>();
    if (uids.length > 0) {
      const refs = uids.map((uid) => db.collection("users").doc(uid));
      const userSnaps = await db.getAll(...refs);
      for (const u of userSnaps) {
        const data = u.data();
        userMap.set(u.id, {
          displayName: data?.displayName ?? "Player",
          email: data?.email ?? null,
        });
      }
    }

    const withdrawals: AdminWithdrawal[] = snap.docs.map((doc) => {
      const data = doc.data();
      const user = userMap.get(data.uid) ?? { displayName: "Player", email: null };
      return {
        id: doc.id,
        uid: data.uid,
        displayName: user.displayName,
        email: user.email,
        bundleId: data.bundleId,
        coins: data.coins,
        phpAmount: data.phpAmount,
        gcashNumber: data.gcashNumber,
        gcashName: data.gcashName,
        status: data.status,
        adminNote: data.adminNote ?? null,
        paymongoTransferId: data.paymongoTransferId ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        processedAt: data.processedAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ withdrawals });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list withdrawals.";
    const status = message.includes("admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
