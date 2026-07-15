import { getFirebaseAuth } from "@/lib/firebase/config";

export async function isUserAdmin(): Promise<boolean> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return false;
  const token = await user.getIdTokenResult();
  return Boolean(token.claims.admin);
}
