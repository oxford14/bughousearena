import { randomUUID } from "crypto";
import { getAdminAuth, getAdminDb, getAdminStorageBucket } from "@/lib/firebase-admin";

function avatarObjectPath(uid: string, ext: "webp" | "jpg"): string {
  return `avatars/${uid}/profile.${ext}`;
}

function publicDownloadUrl(bucketName: string, objectPath: string, token: string): string {
  const encoded = encodeURIComponent(objectPath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media&token=${token}`;
}

async function deleteStoredAvatar(uid: string): Promise<void> {
  const bucket = getAdminStorageBucket();
  await Promise.allSettled([
    bucket.file(avatarObjectPath(uid, "webp")).delete({ ignoreNotFound: true }),
    bucket.file(avatarObjectPath(uid, "jpg")).delete({ ignoreNotFound: true }),
  ]);
}

async function propagatePhotoToFriends(uid: string, photoURL: string | null): Promise<void> {
  const db = getAdminDb();
  const friendsSnap = await db.collection("users").doc(uid).collection("friends").get();
  if (friendsSnap.empty) return;

  const batch = db.batch();
  for (const friendDoc of friendsSnap.docs) {
    batch.update(
      db.collection("users").doc(friendDoc.id).collection("friends").doc(uid),
      { photoURL }
    );
  }
  await batch.commit();
}

async function syncLeaderboardPhoto(
  uid: string,
  displayName: string,
  photoURL: string | null,
  rating: number,
  wins: number
): Promise<void> {
  await getAdminDb()
    .collection("leaderboards")
    .doc("global")
    .collection("entries")
    .doc(uid)
    .set({ displayName, photoURL, rating, wins }, { merge: true });
}

export async function uploadProfilePhotoForUser(
  uid: string,
  buffer: Buffer,
  contentType: string,
  ext: "webp" | "jpg"
): Promise<string> {
  await deleteStoredAvatar(uid);

  const bucket = getAdminStorageBucket();
  const objectPath = avatarObjectPath(uid, ext);
  const token = randomUUID();

  try {
    await bucket.file(objectPath).save(buffer, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: "public, max-age=31536000",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("does not exist")) {
      throw new Error(
        "Firebase Storage is not set up for this project. Run `node scripts/provision-firebase-storage-cli.cjs` after `firebase login`."
      );
    }
    throw err;
  }

  const photoURL = publicDownloadUrl(bucket.name, objectPath, token);

  const userRef = getAdminDb().collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};

  await userRef.update({ photoURL });
  await getAdminAuth().updateUser(uid, { photoURL });

  await Promise.allSettled([
    syncLeaderboardPhoto(
      uid,
      (userData.displayName as string) ?? "Player",
      photoURL,
      (userData.rating as number) ?? 1200,
      (userData.rankedWins as number) ?? 0
    ),
    propagatePhotoToFriends(uid, photoURL),
  ]);

  return photoURL;
}

export async function removeProfilePhotoForUser(uid: string): Promise<void> {
  await deleteStoredAvatar(uid);

  const userRef = getAdminDb().collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};

  await userRef.update({ photoURL: null });
  await getAdminAuth().updateUser(uid, { photoURL: null });

  await Promise.allSettled([
    syncLeaderboardPhoto(
      uid,
      (userData.displayName as string) ?? "Player",
      null,
      (userData.rating as number) ?? 1200,
      (userData.rankedWins as number) ?? 0
    ),
    propagatePhotoToFriends(uid, null),
  ]);
}
