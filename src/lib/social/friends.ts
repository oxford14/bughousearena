import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type {
  DirectMessage,
  FriendEntry,
  FriendRequest,
  UserProfile,
} from "@/types/firestore";

export async function sendFriendRequest(
  from: UserProfile,
  toUid: string
): Promise<void> {
  const reqRef = doc(collection(getFirebaseDb(), "users", toUid, "friendRequests"));
  await setDoc(reqRef, {
    fromUid: from.uid,
    toUid,
    fromDisplayName: from.displayName,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function acceptFriendRequest(
  uid: string,
  request: FriendRequest,
  profile: UserProfile
): Promise<void> {
  const batch = [
    setDoc(doc(getFirebaseDb(), "users", uid, "friends", request.fromUid), {
      friendId: request.fromUid,
      displayName: request.fromDisplayName,
      photoURL: null,
      since: serverTimestamp(),
      onlineStatus: "offline",
    }),
    setDoc(doc(getFirebaseDb(), "users", request.fromUid, "friends", uid), {
      friendId: uid,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      since: serverTimestamp(),
      onlineStatus: "online",
    }),
    updateDoc(
      doc(getFirebaseDb(), "users", uid, "friendRequests", request.id),
      { status: "accepted" }
    ),
  ];
  await Promise.all(batch);
}

export async function declineFriendRequest(
  uid: string,
  requestId: string
): Promise<void> {
  await updateDoc(
    doc(getFirebaseDb(), "users", uid, "friendRequests", requestId),
    { status: "declined" }
  );
}

export function subscribeToFriends(
  uid: string,
  callback: (friends: FriendEntry[]) => void
): () => void {
  return onSnapshot(
    collection(getFirebaseDb(), "users", uid, "friends"),
    (snap) => {
      callback(
        snap.docs.map((d) => ({ ...d.data() }) as FriendEntry)
      );
    }
  );
}

export function subscribeToFriendRequests(
  uid: string,
  callback: (requests: FriendRequest[]) => void
): () => void {
  return onSnapshot(
    query(
      collection(getFirebaseDb(), "users", uid, "friendRequests"),
      where("status", "==", "pending")
    ),
    (snap) => {
      callback(
        snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as FriendRequest
        )
      );
    }
  );
}

export async function sendDirectMessage(
  uid: string,
  friendId: string,
  fromUid: string,
  text: string
): Promise<void> {
  const threadId = [uid, friendId].sort().join("_");
  await addDoc(
    collection(getFirebaseDb(), "users", uid, "messages"),
    { threadId, fromUid, text, read: false, createdAt: serverTimestamp() }
  );
  await addDoc(
    collection(getFirebaseDb(), "users", friendId, "messages"),
    { threadId, fromUid, text, read: false, createdAt: serverTimestamp() }
  );
}

export function subscribeToMessages(
  uid: string,
  callback: (messages: DirectMessage[]) => void
): () => void {
  return onSnapshot(
    query(
      collection(getFirebaseDb(), "users", uid, "messages"),
      orderBy("createdAt", "asc")
    ),
    (snap) => {
      callback(
        snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as DirectMessage
        )
      );
    }
  );
}

export async function updateOnlineStatus(
  uid: string,
  status: UserProfile["onlineStatus"]
): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), "users", uid), {
    onlineStatus: status,
    lastOnline: serverTimestamp(),
  });
}

export async function findUserByDisplayName(
  displayName: string
): Promise<UserProfile | null> {
  const snap = await getDocs(
    query(
      collection(getFirebaseDb(), "users"),
      where("displayName", "==", displayName)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { uid: d.id, ...d.data() } as UserProfile;
}

export interface UserSearchResult {
  uid: string;
  displayName: string;
  photoURL: string | null;
  rating: number;
  onlineStatus: UserProfile["onlineStatus"];
}

const MIN_SEARCH_LENGTH = 2;
const DEFAULT_SEARCH_LIMIT = 8;

function displayNamePrefixEnd(prefix: string): string {
  return `${prefix}\uf8ff`;
}

function searchTermVariants(term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const variants = new Set([trimmed, lower]);
  if (lower.length > 0) {
    variants.add(lower.charAt(0).toUpperCase() + lower.slice(1));
  }
  variants.add(trimmed.toUpperCase());
  return [...variants];
}

/** Prefix search on display name — review results before sending a request. */
export async function searchUsersByDisplayName(
  term: string,
  options?: { excludeUid?: string; limit?: number }
): Promise<UserSearchResult[]> {
  const trimmed = term.trim();
  if (trimmed.length < MIN_SEARCH_LENGTH) return [];

  const limit = options?.limit ?? DEFAULT_SEARCH_LIMIT;
  const needle = trimmed.toLowerCase();
  const seen = new Set<string>();
  const results: UserSearchResult[] = [];

  for (const prefix of searchTermVariants(trimmed)) {
    if (results.length >= limit) break;

    const snap = await getDocs(
      query(
        collection(getFirebaseDb(), "users"),
        where("displayName", ">=", prefix),
        where("displayName", "<=", displayNamePrefixEnd(prefix))
      )
    );

    for (const d of snap.docs) {
      if (seen.has(d.id)) continue;
      if (options?.excludeUid && d.id === options.excludeUid) continue;

      const data = d.data() as UserProfile;
      if (!data.displayName.toLowerCase().includes(needle)) continue;

      seen.add(d.id);
      results.push({
        uid: d.id,
        displayName: data.displayName,
        photoURL: data.photoURL,
        rating: data.rating ?? 1200,
        onlineStatus: data.onlineStatus ?? "offline",
      });

      if (results.length >= limit) break;
    }
  }

  return results.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function removeFriend(uid: string, friendId: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), "users", uid, "friends", friendId));
  await deleteDoc(doc(getFirebaseDb(), "users", friendId, "friends", uid));
}
