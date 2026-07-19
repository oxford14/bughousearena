import { getAdminAuth } from "@/lib/firebase-admin";
import { verifyAuthRequest } from "@/lib/server/verify-auth";
import { isSuperAdminEmail } from "@/lib/admin/super-admins";

export async function verifySuperAdminRequest(
  request: Request
): Promise<{ uid: string; email?: string }> {
  const auth = await verifyAuthRequest(request);
  const decoded = await getAdminAuth().verifyIdToken(
    request.headers.get("Authorization")!.slice(7)
  );

  const isSuper = Boolean(decoded.superAdmin) || isSuperAdminEmail(decoded.email);
  if (!isSuper) {
    throw new Error("Super admin access required.");
  }

  return auth;
}

export async function isSuperAdmin(
  uid: string,
  email?: string | null
): Promise<boolean> {
  try {
    const user = await getAdminAuth().getUser(uid);
    if (user.customClaims?.superAdmin) return true;
    return isSuperAdminEmail(email ?? user.email);
  } catch {
    return isSuperAdminEmail(email);
  }
}
