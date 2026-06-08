import { getAdminAuth } from "@/lib/firebase-admin";

export async function verifyAuthRequest(
  request: Request
): Promise<{ uid: string; email?: string; name?: string }> {
  const header = request.headers.get("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    throw new Error("Must be signed in.");
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name,
  };
}
