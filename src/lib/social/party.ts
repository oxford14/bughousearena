import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type {
  PartyDocument,
  PartyInvite,
  PartyMember,
  UserProfile,
} from "@/types/firestore";

function partyCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function toPartyMember(user: UserProfile): PartyMember {
  return {
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL,
    rating: user.rating,
  };
}

async function getUserPartyId(uid: string): Promise<string | null> {
  const q = query(
    collection(getFirebaseDb(), "parties"),
    where("memberUids", "array-contains", uid),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0]!.id;
}

async function findPartyByCode(code: string): Promise<(PartyDocument & { id: string }) | null> {
  const q = query(
    collection(getFirebaseDb(), "parties"),
    where("code", "==", code),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { ...(d.data() as Omit<PartyDocument, "id">), id: d.id };
}

export async function createParty(user: UserProfile): Promise<string> {
  const existing = await getUserPartyId(user.uid);
  if (existing) await leaveParty(existing, user.uid);

  const ref = doc(collection(getFirebaseDb(), "parties"));
  await setDoc(ref, {
    leaderUid: user.uid,
    code: partyCode(),
    members: [toPartyMember(user)],
    memberUids: [user.uid],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

async function joinPartyInternal(
  partyId: string,
  user: UserProfile
): Promise<(PartyDocument & { id: string }) | null> {
  const partyRef = doc(getFirebaseDb(), "parties", partyId);
  const partySnap = await getDoc(partyRef);
  if (!partySnap.exists()) return null;

  const party = {
    ...(partySnap.data() as Omit<PartyDocument, "id">),
    id: partySnap.id,
  };

  if (party.memberUids.includes(user.uid)) return party;
  if (party.members.length >= 2) return null;

  const existing = await getUserPartyId(user.uid);
  if (existing && existing !== party.id) await leaveParty(existing, user.uid);

  const member = toPartyMember(user);
  const members = [...party.members, member];
  const memberUids = [...party.memberUids, user.uid];

  await updateDoc(partyRef, { members, memberUids });

  return { ...party, members, memberUids };
}

export async function joinPartyById(
  partyId: string,
  user: UserProfile
): Promise<(PartyDocument & { id: string }) | null> {
  return joinPartyInternal(partyId, user);
}

export async function joinPartyByCode(
  code: string,
  user: UserProfile
): Promise<(PartyDocument & { id: string }) | null> {
  const party = await findPartyByCode(code.trim().toUpperCase());
  if (!party) return null;
  return joinPartyInternal(party.id, user);
}

export async function leaveParty(partyId: string, uid: string): Promise<void> {
  const partyRef = doc(getFirebaseDb(), "parties", partyId);
  const partySnap = await getDoc(partyRef);
  if (!partySnap.exists()) return;

  const party = partySnap.data() as PartyDocument;
  if (!party.memberUids.includes(uid)) return;

  const members = party.members.filter((m) => m.uid !== uid);
  const memberUids = party.memberUids.filter((id) => id !== uid);

  if (members.length === 0) {
    await deleteDoc(partyRef);
    return;
  }

  const leaderUid =
    party.leaderUid === uid ? members[0]!.uid : party.leaderUid;

  await updateDoc(partyRef, { members, memberUids, leaderUid });
}

export async function inviteFriendToParty(
  from: UserProfile,
  toUid: string,
  party: PartyDocument
): Promise<void> {
  if (party.members.length >= 2) return;
  if (party.memberUids.includes(toUid)) return;

  const inviteRef = doc(
    collection(getFirebaseDb(), "users", toUid, "partyInvites")
  );
  await setDoc(inviteRef, {
    partyId: party.id,
    fromUid: from.uid,
    fromDisplayName: from.displayName,
    toUid,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function acceptPartyInvite(
  user: UserProfile,
  invite: PartyInvite
): Promise<(PartyDocument & { id: string }) | null> {
  const joined = invite.partyId
    ? await joinPartyById(invite.partyId, user)
    : invite.partyCode
      ? await joinPartyByCode(invite.partyCode, user)
      : null;
  if (joined) {
    await updateDoc(
      doc(getFirebaseDb(), "users", user.uid, "partyInvites", invite.id),
      { status: "accepted" }
    );
  }
  return joined;
}

export async function declinePartyInvite(
  uid: string,
  inviteId: string
): Promise<void> {
  await updateDoc(
    doc(getFirebaseDb(), "users", uid, "partyInvites", inviteId),
    { status: "declined" }
  );
}

export function subscribeToParty(
  partyId: string,
  callback: (party: PartyDocument | null) => void
): () => void {
  return onSnapshot(doc(getFirebaseDb(), "parties", partyId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ ...(snap.data() as Omit<PartyDocument, "id">), id: snap.id });
  });
}

export function subscribeToUserParty(
  uid: string,
  callback: (party: (PartyDocument & { id: string }) | null) => void
): () => void {
  const q = query(
    collection(getFirebaseDb(), "parties"),
    where("memberUids", "array-contains", uid),
    limit(1)
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback(null);
      return;
    }
    const d = snap.docs[0]!;
    callback({ ...(d.data() as Omit<PartyDocument, "id">), id: d.id });
  });
}

export function subscribeToPartyInvites(
  uid: string,
  callback: (invites: PartyInvite[]) => void
): () => void {
  const q = query(
    collection(getFirebaseDb(), "users", uid, "partyInvites"),
    where("status", "==", "pending")
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PartyInvite)
    );
  });
}

export function isPartyLeader(party: PartyDocument, uid: string): boolean {
  return party.leaderUid === uid;
}

export function canQueueParty(party: PartyDocument | null, uid: string): boolean {
  if (!party) return true;
  return party.leaderUid === uid;
}
