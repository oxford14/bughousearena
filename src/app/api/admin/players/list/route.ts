import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";
import { isSuperAdminEmail } from "@/lib/admin/super-admins";
import type { AdminPlayer } from "@/lib/admin/admin-api";

export const runtime = "nodejs";

const MAX_RESULTS = 100;

export async function GET(request: Request) {
  try {
    await verifySuperAdminRequest(request);
    const db = getAdminDb();
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

    const snap = await db
      .collection("users")
      .orderBy("createdAt", "desc")
      .limit(400)
      .get();

    let docs = snap.docs;
    if (q) {
      docs = docs.filter((doc) => {
        const data = doc.data();
        const name = String(data.displayName ?? "").toLowerCase();
        const email = String(data.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q) || doc.id === q;
      });
    }
    docs = docs.slice(0, MAX_RESULTS);

    const authRecords = new Map<
      string,
      { admin: boolean; superAdmin: boolean }
    >();
    const ids = docs.map((d) => ({ uid: d.id }));
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const result = await getAdminAuth().getUsers(chunk);
      for (const user of result.users) {
        authRecords.set(user.uid, {
          admin: Boolean(user.customClaims?.admin),
          superAdmin:
            Boolean(user.customClaims?.superAdmin) ||
            isSuperAdminEmail(user.email),
        });
      }
    }

    const players: AdminPlayer[] = docs.map((doc) => {
      const data = doc.data();
      const claims = authRecords.get(doc.id) ?? {
        admin: false,
        superAdmin: false,
      };
      return {
        uid: doc.id,
        displayName: data.displayName ?? "Player",
        email: data.email ?? null,
        photoURL: data.photoURL ?? null,
        arenaCoins: data.arenaCoins ?? 0,
        rating: data.rating ?? 0,
        completedMatches: data.completedMatches ?? 0,
        totalTopUpCentavos: data.totalTopUpCentavos ?? 0,
        banned: Boolean(data.banned),
        admin: claims.admin,
        superAdmin: claims.superAdmin,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ players });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list players.";
    const status = message.includes("admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
