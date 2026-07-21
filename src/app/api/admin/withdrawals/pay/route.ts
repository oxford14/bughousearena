import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSafeAppOrigin } from "@/lib/server/app-origin";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import {
  adminPayBodySchema,
  zodErrorMessage,
} from "@/lib/server/schemas/api-bodies";
import { verifySuperAdminRequest } from "@/lib/server/verify-super-admin";
import {
  createInstapayTransfer,
  getInstapayReceivingBic,
} from "@/lib/paymongo-payout";
import { markRedemptionProcessing } from "@/lib/wallet/redeem-server";
import { resolveInstapayInstitutionName } from "@/lib/wallet/payout-methods";
import type { RedemptionPayoutMethod } from "@/types/wallet";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { uid } = await verifySuperAdminRequest(request);

    const limited = await enforceApiRateLimits(request, {
      uid,
      tier: "admin",
    });
    if (limited) return limited;

    const parsed = adminPayBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodErrorMessage(parsed.error) },
        { status: 400 }
      );
    }
    const { requestId } = parsed.data;

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

    const payoutMethod = (data.payoutMethod as RedemptionPayoutMethod | undefined) ?? "gcash";
    const accountNumber = String(
      data.accountNumber ?? data.gcashNumber ?? ""
    );
    const accountName = String(data.accountName ?? data.gcashName ?? "");
    const bankName = (data.bankName as string | null | undefined) ?? null;

    const destinationBic = await getInstapayReceivingBic(
      secretKey,
      resolveInstapayInstitutionName({ method: payoutMethod, bankName })
    );
    const transfer = await createInstapayTransfer({
      secretKey,
      amountCentavos: Math.round((data.phpAmount as number) * 100),
      accountNumber,
      accountName,
      destinationBic,
      sourceNumber,
      sourceName,
      description: `Bughouse Arena payout ${requestId}`,
      callbackUrl: `${getSafeAppOrigin(request)}/api/paymongo/webhook`,
      metadata: { requestId, uid: data.uid, payoutMethod },
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
