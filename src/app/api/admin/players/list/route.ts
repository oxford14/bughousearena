import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";
import { isSuperAdminEmail } from "@/lib/admin/super-admins";
import type { AdminPlayer } from "@/lib/admin/admin-api";
import { resolveOnlineStatus } from "@/lib/social/presence";

export const runtime = "nodejs";

const MAX_RESULTS = 100;

export async function GET(request: Request) {
  try {
    const { uid } = await verifySuperAdminRequest(request);
    const limited = await enforceApiRateLimits(request, {
      uid,
      tier: "admin",
    });
    if (limited) return limited;

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

    const sessionRefs = docs.map((d) =>
      db.collection("users").doc(d.id).collection("session").doc("active")
    );
    const sessionSnaps =
      sessionRefs.length > 0 ? await db.getAll(...sessionRefs) : [];

    const matchIdByUid = new Map<string, string>();
    for (const sessionSnap of sessionSnaps) {
      if (!sessionSnap.exists) continue;
      const matchId = sessionSnap.data()?.matchId as string | undefined;
      if (!matchId) continue;
      const uid = sessionSnap.ref.parent.parent?.id;
      if (uid) matchIdByUid.set(uid, matchId);
    }

    const uniqueMatchIds = Array.from(new Set(matchIdByUid.values()));
    const liveMatchIds = new Set<string>();
    if (uniqueMatchIds.length > 0) {
      const matchRefs = uniqueMatchIds.map((id) =>
        db.collection("matches").doc(id)
      );
      const matchSnaps = await db.getAll(...matchRefs);
      for (const matchSnap of matchSnaps) {
        if (!matchSnap.exists) continue;
        const status = matchSnap.data()?.status as string | undefined;
        if (status === "setup" || status === "active") {
          liveMatchIds.add(matchSnap.id);
        }
      }
    }

    const queueByUid = new Map<
      string,
      { mode: AdminPlayer["queueMode"]; stakePerPlayer: number | null }
    >();
    const queueSnap = await db.collection("matchmaking").limit(200).get();
    for (const entry of queueSnap.docs) {
      const data = entry.data();
      const mode = data.mode as AdminPlayer["queueMode"];
      if (
        mode !== "casual" &&
        mode !== "ranked" &&
        mode !== "private" &&
        mode !== "stake"
      ) {
        continue;
      }
      const stakePerPlayer =
        typeof data.stakePerPlayer === "number" ? data.stakePerPlayer : null;
      const memberUids = Array.isArray(data.memberUids)
        ? (data.memberUids as string[])
        : [];
      const uids = new Set<string>([
        ...(typeof data.uid === "string" ? [data.uid] : []),
        ...memberUids,
      ]);
      for (const memberUid of uids) {
        if (!queueByUid.has(memberUid)) {
          queueByUid.set(memberUid, { mode, stakePerPlayer });
        }
      }
    }

    const historyCounts = new Map<string, number>();
    await Promise.all(
      docs.map(async (userDoc) => {
        try {
          const countSnap = await db
            .collection("matchHistory")
            .doc(userDoc.id)
            .collection("games")
            .count()
            .get();
          historyCounts.set(userDoc.id, countSnap.data().count);
        } catch {
          historyCounts.set(userDoc.id, 0);
        }
      })
    );

    const players: AdminPlayer[] = docs.map((doc) => {
      const data = doc.data();
      const claims = authRecords.get(doc.id) ?? {
        admin: false,
        superAdmin: false,
      };
      const sessionMatchId = matchIdByUid.get(doc.id) ?? null;
      const inGame = Boolean(
        sessionMatchId && liveMatchIds.has(sessionMatchId)
      );
      const queue = queueByUid.get(doc.id);
      const rankedPlayed =
        ((data.rankedWins as number | undefined) ?? 0) +
        ((data.rankedLosses as number | undefined) ?? 0);
      const historyCount = historyCounts.get(doc.id) ?? 0;
      const completedMatches = Math.max(
        (data.completedMatches as number | undefined) ?? 0,
        historyCount,
        rankedPlayed
      );
      return {
        uid: doc.id,
        displayName: data.displayName ?? "Player",
        email: data.email ?? null,
        photoURL: data.photoURL ?? null,
        arenaCoins: data.arenaCoins ?? 0,
        rating: data.rating ?? 0,
        completedMatches,
        totalTopUpCentavos: data.totalTopUpCentavos ?? 0,
        banned: Boolean(data.banned),
        admin: claims.admin,
        superAdmin: claims.superAdmin,
        onlineStatus: resolveOnlineStatus(
          data.onlineStatus,
          data.lastOnline?.toDate?.() ?? null
        ),
        lastOnline: data.lastOnline?.toDate?.()?.toISOString() ?? null,
        inGame,
        activeMatchId: inGame ? sessionMatchId : null,
        inQueue: Boolean(queue),
        queueMode: queue?.mode ?? null,
        queueStakePerPlayer: queue?.stakePerPlayer ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    // Heal undercounted profiles so redeem eligibility and future lists stay accurate.
    const undercounted = players.filter((p) => {
      const stored =
        (docs.find((d) => d.id === p.uid)?.data().completedMatches as
          | number
          | undefined) ?? 0;
      return p.completedMatches > stored;
    });
    if (undercounted.length > 0) {
      let batch = db.batch();
      let ops = 0;
      for (const player of undercounted) {
        batch.update(db.collection("users").doc(player.uid), {
          completedMatches: player.completedMatches,
        });
        ops += 1;
        if (ops >= 400) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
      if (ops > 0) await batch.commit();
    }

    return NextResponse.json({ players });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list players.";
    const status = message.includes("admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
