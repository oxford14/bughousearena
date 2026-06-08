import { FirebaseError } from "firebase/app";

const CALLABLE_ERROR_MESSAGES: Record<string, string> = {
  "functions/not-found":
    "Top-up service is unavailable. Cloud functions may need to be deployed.",
  "functions/unauthenticated": "Sign in to top up coins.",
  "functions/permission-denied": "You do not have permission for this action.",
  "functions/invalid-argument": "Invalid top-up selection.",
  "functions/internal":
    "Top-up failed on the server. If this persists, PayMongo keys may be missing from cloud functions.",
};

export function formatCallableError(error: unknown, fallback = "Request failed."): string {
  if (error instanceof FirebaseError) {
    const mapped = CALLABLE_ERROR_MESSAGES[error.code];
    if (mapped) return mapped;

    if (error.message && !error.message.startsWith("functions/")) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
