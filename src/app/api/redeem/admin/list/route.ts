import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/server/verify-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await verifyAdminRequest(request);
    const snap = await getAdminDb()
      .collection("redemptionRequests")
      .where("status", "==", "pending")
      .orderBy("createdAt", "asc")
      .limit(50)
      .get();

    const requests = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        bundleId: data.bundleId,
        coins: data.coins,
        phpAmount: data.phpAmount,
        gcashNumber: data.gcashNumber,
        gcashName: data.gcashName,
        status: data.status,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ requests });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "List requests failed.";
    const status = message.includes("Admin") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
