import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/config";
import type {
  HouseChatMessage,
  HouseDocument,
  HouseMember,
  HouseRole,
  UserProfile,
} from "@/types/firestore";

export async function createHouse(
  founder: UserProfile,
  name: string,
  description: string
): Promise<string> {
  const houseRef = doc(collection(getFirebaseDb(), "houses"));
  await setDoc(houseRef, {
    name,
    description,
    bannerUrl: "/assets/houses/default-banner.svg",
    crestUrl: "/assets/houses/default-crest.svg",
    founderId: founder.uid,
    houseRating: 1200,
    memberCount: 1,
    autoAccept: false,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(houseRef, "members", founder.uid), {
    uid: founder.uid,
    displayName: founder.displayName,
    role: "founder",
    joinedAt: serverTimestamp(),
  });

  await updateDoc(doc(getFirebaseDb(), "users", founder.uid), {
    houseId: houseRef.id,
  });

  return houseRef.id;
}

export async function joinHouse(
  houseId: string,
  user: UserProfile
): Promise<void> {
  if (user.houseId) {
    throw new Error("Leave your current house before joining another.");
  }

  const house = await getHouse(houseId);
  if (!house) throw new Error("House not found");

  const existingMember = await getDoc(
    doc(getFirebaseDb(), "houses", houseId, "members", user.uid)
  );
  if (existingMember.exists()) {
    throw new Error("Already a member of this house.");
  }

  if (!house.autoAccept) {
    throw new Error("This house requires founder approval to join.");
  }

  await setDoc(doc(getFirebaseDb(), "houses", houseId, "members", user.uid), {
    uid: user.uid,
    displayName: user.displayName,
    role: "member",
    joinedAt: serverTimestamp(),
  });
  await updateDoc(doc(getFirebaseDb(), "houses", houseId), {
    memberCount: increment(1),
  });
  await updateDoc(doc(getFirebaseDb(), "users", user.uid), { houseId });
}

export async function leaveHouse(houseId: string, user: UserProfile): Promise<void> {
  if (user.houseId !== houseId) {
    throw new Error("You are not in this house.");
  }

  const memberRef = doc(getFirebaseDb(), "houses", houseId, "members", user.uid);
  const memberSnap = await getDoc(memberRef);
  if (!memberSnap.exists()) {
    throw new Error("Membership not found.");
  }

  const role = (memberSnap.data() as HouseMember).role;
  if (role === "founder") {
    throw new Error("Founders cannot leave. Transfer ownership or delete the house.");
  }

  await deleteDoc(memberRef);
  await updateDoc(doc(getFirebaseDb(), "users", user.uid), { houseId: null });
  await updateDoc(doc(getFirebaseDb(), "houses", houseId), {
    memberCount: increment(-1),
  });
}

export async function kickMember(
  houseId: string,
  actorUid: string,
  targetUid: string
): Promise<void> {
  if (actorUid === targetUid) {
    throw new Error("You cannot kick yourself.");
  }

  const actorSnap = await getDoc(
    doc(getFirebaseDb(), "houses", houseId, "members", actorUid)
  );
  if (!actorSnap.exists()) throw new Error("Not a house member.");
  const actorRole = (actorSnap.data() as HouseMember).role;
  if (actorRole !== "founder" && actorRole !== "steward") {
    throw new Error("Only house admins can remove members.");
  }

  const targetRef = doc(getFirebaseDb(), "houses", houseId, "members", targetUid);
  const targetSnap = await getDoc(targetRef);
  if (!targetSnap.exists()) throw new Error("Member not found.");

  const targetRole = (targetSnap.data() as HouseMember).role;
  if (targetRole === "founder") {
    throw new Error("The founder cannot be removed.");
  }
  if (actorRole === "steward" && targetRole === "steward") {
    throw new Error("Stewards cannot remove other stewards.");
  }

  await deleteDoc(targetRef);
  await updateDoc(doc(getFirebaseDb(), "users", targetUid), { houseId: null });
  await updateDoc(doc(getFirebaseDb(), "houses", houseId), {
    memberCount: increment(-1),
  });
}

export interface HouseSettingsUpdate {
  name?: string;
  description?: string;
  autoAccept?: boolean;
}

export async function updateHouseSettings(
  houseId: string,
  settings: HouseSettingsUpdate
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (settings.name != null) payload.name = settings.name.trim();
  if (settings.description != null) payload.description = settings.description.trim();
  if (settings.autoAccept != null) payload.autoAccept = settings.autoAccept;
  if (Object.keys(payload).length === 0) return;
  await updateDoc(doc(getFirebaseDb(), "houses", houseId), payload);
}

export function isHouseAdminRole(role: HouseRole | undefined): boolean {
  return role === "founder" || role === "steward";
}

export function isHouseFounder(member: HouseMember | undefined, house: HouseDocument): boolean {
  return member?.role === "founder" || member?.uid === house.founderId;
}

export async function getHouse(houseId: string): Promise<HouseDocument | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "houses", houseId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as HouseDocument;
}

export function subscribeToHouses(
  callback: (houses: HouseDocument[]) => void
): () => void {
  return onSnapshot(
    query(collection(getFirebaseDb(), "houses"), orderBy("houseRating", "desc"), limit(50)),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HouseDocument));
    }
  );
}

export function subscribeToHouseMembers(
  houseId: string,
  callback: (members: HouseMember[]) => void
): () => void {
  return onSnapshot(
    collection(getFirebaseDb(), "houses", houseId, "members"),
    (snap) => {
      callback(snap.docs.map((d) => d.data() as HouseMember));
    }
  );
}

export async function sendHouseMessage(
  houseId: string,
  uid: string,
  displayName: string,
  text: string
): Promise<void> {
  await addDoc(collection(getFirebaseDb(), "houses", houseId, "chat"), {
    uid,
    displayName,
    text,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToHouseChat(
  houseId: string,
  callback: (messages: HouseChatMessage[]) => void
): () => void {
  return onSnapshot(
    query(
      collection(getFirebaseDb(), "houses", houseId, "chat"),
      orderBy("createdAt", "asc"),
      limit(100)
    ),
    (snap) => {
      callback(
        snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as HouseChatMessage
        )
      );
    }
  );
}

export async function updateMemberRole(
  houseId: string,
  uid: string,
  role: HouseRole
): Promise<void> {
  await updateDoc(doc(getFirebaseDb(), "houses", houseId, "members", uid), {
    role,
  });
}

export async function searchHouses(queryText: string): Promise<HouseDocument[]> {
  const snap = await getDocs(collection(getFirebaseDb(), "houses"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as HouseDocument)
    .filter((h) => h.name.toLowerCase().includes(queryText.toLowerCase()));
}
