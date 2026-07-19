import { NextResponse } from "next/server";
import { AggregateField } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";

export const runtime = "nodejs";

export interface AdminStats {
  players: number;
  coinsInCirculation: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsPhp: number;
  processingWithdrawalsCount: number;
  totalPaidOutPhp: number;
  revenueCentavos: number;
  activeTournaments: number;
}

export async function GET(request: Request) {
  try {
    await verifySuperAdminRequest(request);
    const db = getAdminDb();

    const usersCol = db.collection("users");
    const redemptions = db.collection("redemptionRequests");
    const purchases = db.collection("coinPurchases");
    const tournaments = db.collection("tournaments");

    const [
      playersSnap,
      coinsSnap,
      pendingSnap,
      processingSnap,
      paidSnap,
      revenueSnap,
      registrationSnap,
      activeSnap,
    ] = await Promise.all([
      usersCol.count().get(),
      usersCol.aggregate({ total: AggregateField.sum("arenaCoins") }).get(),
      redemptions
        .where("status", "==", "pending")
        .aggregate({
          count: AggregateField.count(),
          php: AggregateField.sum("phpAmount"),
        })
        .get(),
      redemptions.where("status", "==", "processing").count().get(),
      redemptions
        .where("status", "==", "paid")
        .aggregate({ php: AggregateField.sum("phpAmount") })
        .get(),
      purchases
        .where("status", "==", "paid")
        .aggregate({ centavos: AggregateField.sum("amountCentavos") })
        .get(),
      tournaments.where("status", "==", "registration").count().get(),
      tournaments.where("status", "==", "active").count().get(),
    ]);

    const stats: AdminStats = {
      players: playersSnap.data().count,
      coinsInCirculation: coinsSnap.data().total ?? 0,
      pendingWithdrawalsCount: pendingSnap.data().count,
      pendingWithdrawalsPhp: pendingSnap.data().php ?? 0,
      processingWithdrawalsCount: processingSnap.data().count,
      totalPaidOutPhp: paidSnap.data().php ?? 0,
      revenueCentavos: revenueSnap.data().centavos ?? 0,
      activeTournaments: registrationSnap.data().count + activeSnap.data().count,
    };

    return NextResponse.json(stats);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load stats.";
    const status = message.includes("admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
