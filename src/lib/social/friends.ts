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

export async function removeFriend(uid: string, friendId: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), "users", uid, "friends", friendId));
  await deleteDoc(doc(getFirebaseDb(), "users", friendId, "friends", uid));
}
