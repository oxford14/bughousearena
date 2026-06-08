import { getFirebaseAuth } from "@/lib/firebase/config";
import { optimizeAvatarImage } from "@/lib/media/optimize-avatar-image";

const UPLOAD_TIMEOUT_MS = 45_000;

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("Sign in to update your profile photo.");
  }
  const idToken = await user.getIdToken();
  return { Authorization: `Bearer ${idToken}` };
}

async function parseApiError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "Upload failed.";
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Upload timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Crop on client, compress locally, upload via server API (avoids Storage CORS hangs). */
export async function uploadProfilePhoto(croppedBlob: Blob): Promise<string> {
  const optimized = await optimizeAvatarImage(croppedBlob);
  const headers = await getAuthHeaders();

  const form = new FormData();
  form.append(
    "photo",
    new File([optimized.blob], `profile.${optimized.ext}`, {
      type: optimized.contentType,
    })
  );

  const response = await fetchWithTimeout(
    "/api/profile/photo",
    { method: "POST", headers, body: form },
    UPLOAD_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as { photoURL?: string };
  if (!data.photoURL) {
    throw new Error("Upload succeeded but no photo URL was returned.");
  }
  return data.photoURL;
}

export async function removeProfilePhoto(): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(
    "/api/profile/photo",
    { method: "DELETE", headers },
    UPLOAD_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}
