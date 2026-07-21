import { NextResponse } from "next/server";
import {
  removeProfilePhotoForUser,
  uploadProfilePhotoForUser,
} from "@/lib/server/profile-photo";
import { enforceApiRateLimits } from "@/lib/server/rate-limit";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export const runtime = "nodejs";

const MAX_BYTES = 512 * 1024;
const ALLOWED_TYPES = new Set(["image/webp", "image/jpeg"]);

export async function POST(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const limited = await enforceApiRateLimits(request, { uid });
    if (limited) return limited;

    const form = await request.formData();
    const file = form.get("photo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Photo file is required." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use WebP or JPEG." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image is too large after compression." },
        { status: 400 }
      );
    }

    const ext = file.type === "image/webp" ? "webp" : "jpg";
    const buffer = Buffer.from(await file.arrayBuffer());
    const photoURL = await uploadProfilePhotoForUser(uid, buffer, file.type, ext);

    return NextResponse.json({ ok: true, photoURL });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not upload profile photo.";
    console.error("[Profile Photo]", message, error);
    const status =
      message === "Must be signed in."
        ? 401
        : message.includes("not configured")
          ? 503
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const { uid } = await verifyAuthRequest(request);
    const limited = await enforceApiRateLimits(request, { uid });
    if (limited) return limited;

    await removeProfilePhotoForUser(uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not remove profile photo.";
    console.error("[Profile Photo Delete]", message, error);
    const status = message === "Must be signed in." ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
