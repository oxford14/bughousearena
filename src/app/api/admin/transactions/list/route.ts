import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";

export const runtime = "nodejs";

export interface AdminTransaction {
  id: string;
  uid: string;
  displayName: string;
  amount: number;
  type: string;
  refId: string;
  balanceAfter: number;
  createdAt: string | null;
}

export async function GET(request: Request) {
  try {
    await verifySuperAdminRequest(request);
    const db = getAdminDb();
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const uid = url.searchParams.get("uid");

    let ref = db.collection("coinLedger").orderBy("createdAt", "desc").limit(100);
    if (type) ref = db.collection("coinLedger").where("type", "==", type).orderBy("createdAt", "desc").limit(100);
    if (uid) ref = db.collection("coinLedger").where("uid", "==", uid).orderBy("createdAt", "desc").limit(100);

    const snap = await ref.get();

    const uids = Array.from(
      new Set(snap.docs.map((d) => d.data().uid as string).filter(Boolean))
    );
    const nameMap = new Map<string, string>();
    if (uids.length > 0) {
      const refs = uids.map((u) => db.collection("users").doc(u));
      const users = await db.getAll(...refs);
      for (const u of users) {
        nameMap.set(u.id, u.data()?.displayName ?? "Player");
      }
    }

    const transactions: AdminTransaction[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        displayName: nameMap.get(data.uid) ?? "Player",
        amount: data.amount ?? 0,
        type: data.type ?? "",
        refId: data.refId ?? "",
        balanceAfter: data.balanceAfter ?? 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load transactions.";
    const status = message.includes("admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
