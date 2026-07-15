import { getAdminAuth } from "@/lib/firebase-admin";
import { verifyAuthRequest } from "@/lib/server/verify-auth";

export async function verifyAdminRequest(
  request: Request
): Promise<{ uid: string; email?: string }> {
  const auth = await verifyAuthRequest(request);
  const decoded = await getAdminAuth().verifyIdToken(
    request.headers.get("Authorization")!.slice(7)
  );

  if (!decoded.admin) {
    throw new Error("Admin access required.");
  }

  return auth;
}

export async function isUserAdmin(uid: string): Promise<boolean> {
  try {
    const user = await getAdminAuth().getUser(uid);
    return Boolean(user.customClaims?.admin);
  } catch {
    return false;
  }
}
