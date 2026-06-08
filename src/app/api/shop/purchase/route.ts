import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { purchaseShopItemForUser } from "@/lib/shop/shop-server";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

function purchaseErrorStatus(message: string): number {
  if (message.includes("Not enough")) return 412;
  if (message.includes("already own")) return 409;
  if (message === "Must be signed in.") return 401;
  return 400;
}

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const { itemId } = (await request.json()) as { itemId?: string };

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId is required." }, { status: 400 });
    }

    const result = await purchaseShopItemForUser(getAdminDb(), uid, itemId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Purchase failed.";
    console.error("[Shop Purchase]", message);
    return NextResponse.json(
      { error: message },
      { status: purchaseErrorStatus(message) }
    );
  }
}
