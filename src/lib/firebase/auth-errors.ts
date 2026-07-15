import { FirebaseError } from "firebase/app";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/popup-blocked":
    "The sign-in popup was blocked. Allow popups for this site or try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/cancelled-popup-request": "Sign-in was cancelled.",
  "auth/unauthorized-domain":
    "This site URL is not authorized in Firebase. Use https://bughousearena.com or http://localhost:3000 locally.",
  "auth/operation-not-allowed":
    "Google sign-in is not enabled for this Firebase project.",
  "auth/network-request-failed":
    "Network error — check your connection and try again.",
  "auth/invalid-api-key": "Invalid Firebase API key in .env.local.",
};

export function formatAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    return AUTH_ERROR_MESSAGES[error.code] ?? error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Sign-in failed. Please try again.";
}

export function shouldFallbackToGoogleRedirect(error: unknown): boolean {
  if (!(error instanceof FirebaseError)) return false;
  return (
    error.code === "auth/popup-blocked" ||
    error.code === "auth/cancelled-popup-request"
  );
}
