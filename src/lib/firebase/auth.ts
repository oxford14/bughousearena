import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "./config";
import { shouldFallbackToGoogleRedirect } from "./auth-errors";
import type { UserProfile } from "@/types/firestore";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(result.user);
    return result.user;
  } catch (error) {
    if (shouldFallbackToGoogleRedirect(error)) {
      await signInWithRedirect(auth, googleProvider);
      throw new Error("REDIRECT_PENDING");
    }
    throw error;
  }
}

/** Complete Google redirect sign-in when returning to /login. */
export async function completeGoogleRedirectSignIn(): Promise<User | null> {
  const auth = getFirebaseAuth();
  const result = await getRedirectResult(auth);
  if (!result?.user) return null;
  await ensureUserProfile(result.user);
  return result.user;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const result = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password
  );
  await ensureUserProfile(result.user);
  return result.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password
  );
  await updateProfile(result.user, { displayName });
  await ensureUserProfile(result.user);
  return result.user;
}

export async function logOut(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export function usesEmailPassword(user: User): boolean {
  return user.providerData.some((p) => p.providerId === "password");
}

export async function changeUserPassword(
  user: User,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (!user.email) {
    throw new Error("This account has no email address.");
  }
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(getFirebaseDb(), "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { uid: user.uid, ...snap.data() } as UserProfile;
  }

  const profile: Omit<UserProfile, "uid"> = {
    displayName: user.displayName ?? "Arena Player",
    photoURL: user.photoURL,
    email: user.email,
    rating: 1200,
    rankedWins: 0,
    rankedLosses: 0,
    arenaCoins: 0,
    ownedItems: [],
    houseId: null,
    onlineStatus: "online",
    lastOnline: null,
    createdAt: serverTimestamp() as UserProfile["createdAt"],
  };

  await setDoc(ref, profile);
  return { uid: user.uid, ...profile } as UserProfile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "users", uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}
