import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  equipShopItemForUser,
  type EquipSlot,
} from "@/lib/shop/shop-server";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

const VALID_SLOTS: EquipSlot[] = [
  "boardTheme",
  "pieceSet",
  "victoryFx",
  "avatarFrame",
  "emotes",
];

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const { slot, value } = (await request.json()) as {
      slot?: EquipSlot;
      value?: string | string[];
    };

    if (!slot || !VALID_SLOTS.includes(slot)) {
      return NextResponse.json({ error: "Invalid equip slot." }, { status: 400 });
    }
    if (value === undefined || value === null) {
      return NextResponse.json({ error: "value is required." }, { status: 400 });
    }

    await equipShopItemForUser(getAdminDb(), uid, slot, value);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Equip failed.";
    console.error("[Shop Equip]", message);
    const status = message === "Must be signed in." ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
