import { NextResponse } from "next/server";
import { PRODUCTION_APP_ORIGIN } from "@/lib/app-config";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";
import {
  createGcashTransfer,
  getGcashReceivingBic,
} from "@/lib/paymongo-payout";
import { markRedemptionProcessing } from "@/lib/wallet/redeem-server";

export const runtime = "nodejs";

function getAppOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") return PRODUCTION_APP_ORIGIN;
  return "http://localhost:3000";
}

export async function POST(request: Request) {
  try {
    await verifySuperAdminRequest(request);
    const { requestId } = (await request.json()) as { requestId?: string };
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    const sourceNumber = process.env.PAYMONGO_WALLET_ACCOUNT_NUMBER;
    const sourceName = process.env.PAYMONGO_WALLET_NAME;
    if (!secretKey || !sourceNumber || !sourceName) {
      return NextResponse.json(
        {
          error:
            "PayMongo payouts are not configured. Set PAYMONGO_SECRET_KEY, PAYMONGO_WALLET_ACCOUNT_NUMBER, and PAYMONGO_WALLET_NAME.",
        },
        { status: 500 }
      );
    }

    const db = getAdminDb();
    const requestRef = db.collection("redemptionRequests").doc(requestId);
    const snap = await requestRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    const data = snap.data()!;
    if (data.status !== "pending") {
      return NextResponse.json(
        { error: `Request is not payable (status: ${data.status}).` },
        { status: 400 }
      );
    }

    const gcashBic = await getGcashReceivingBic(secretKey);
    const transfer = await createGcashTransfer({
      secretKey,
      amountCentavos: Math.round((data.phpAmount as number) * 100),
      gcashNumber: data.gcashNumber as string,
      gcashName: data.gcashName as string,
      gcashBic,
      sourceNumber,
      sourceName,
      description: `Bughouse Arena payout ${requestId}`,
      callbackUrl: `${getAppOrigin(request)}/api/paymongo/webhook`,
      metadata: { requestId, uid: data.uid },
    });

    await markRedemptionProcessing(
      db,
      requestId,
      transfer.transferId,
      transfer.batchId
    );

    return NextResponse.json({
      status: "processing",
      transferId: transfer.transferId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Payout failed.";
    const status = message.includes("admin") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
