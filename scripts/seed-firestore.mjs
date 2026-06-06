/**
 * Seed Firestore with demo leaderboard, houses, and sample users metadata.
 * Run: npm run seed
 *
 * Requires Firebase Admin credentials (Application Default Credentials from `firebase login`).
 */
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID ?? "bughousearena";

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();

const leaderboardSeeds = [
  { id: "seed-player-1", displayName: "GrandmasterDrop", rating: 2340, wins: 412, photoURL: null },
  { id: "seed-player-2", displayName: "BugHouseKing", rating: 2285, wins: 388, photoURL: null },
  { id: "seed-player-3", displayName: "PieceStorm", rating: 2210, wins: 351, photoURL: null },
  { id: "seed-player-4", displayName: "ArenaQueen", rating: 2150, wins: 302, photoURL: null },
  { id: "seed-player-5", displayName: "KnightRider", rating: 2090, wins: 276, photoURL: null },
  { id: "seed-player-6", displayName: "DropMaster", rating: 1980, wins: 241, photoURL: null },
  { id: "seed-player-7", displayName: "CastleCrusher", rating: 1850, wins: 198, photoURL: null },
  { id: "seed-player-8", displayName: "PawnStorm", rating: 1720, wins: 165, photoURL: null },
];

const houseSeeds = [
  {
    id: "house-dragons",
    name: "House of Dragons",
    description: "Aggressive bughouse tactics and fearless drops.",
    houseRating: 2100,
    memberCount: 3,
    founderId: "seed-player-1",
  },
  {
    id: "house-phoenix",
    name: "Phoenix Order",
    description: "Rising from every blunder — coordinated team play.",
    houseRating: 1980,
    memberCount: 2,
    founderId: "seed-player-3",
  },
];

async function seedLeaderboards() {
  const batch = db.batch();
  for (const entry of leaderboardSeeds) {
    const ref = db.collection("leaderboards").doc("global").collection("entries").doc(entry.id);
    batch.set(ref, {
      displayName: entry.displayName,
      photoURL: entry.photoURL,
      rating: entry.rating,
      wins: entry.wins,
    }, { merge: true });
  }
  await batch.commit();
  console.log(`Seeded ${leaderboardSeeds.length} global leaderboard entries.`);
}

async function seedSeasonal() {
  const batch = db.batch();
  for (const entry of leaderboardSeeds.slice(0, 5)) {
    const ref = db
      .collection("leaderboards")
      .doc("season-current")
      .collection("entries")
      .doc(entry.id);
    batch.set(
      ref,
      {
        displayName: entry.displayName,
        photoURL: entry.photoURL,
        rating: entry.rating,
        wins: entry.wins,
      },
      { merge: true }
    );
  }
  await batch.commit();
  console.log("Seeded seasonal leaderboard entries.");
}

async function seedHouses() {
  for (const house of houseSeeds) {
    const houseRef = db.collection("houses").doc(house.id);
    await houseRef.set({
      name: house.name,
      description: house.description,
      bannerUrl: "/assets/houses/default-banner.svg",
      crestUrl: "/assets/houses/default-crest.svg",
      founderId: house.founderId,
      houseRating: house.houseRating,
      memberCount: house.memberCount,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await houseRef.collection("members").doc(house.founderId).set({
      uid: house.founderId,
      displayName: leaderboardSeeds.find((p) => p.id === house.founderId)?.displayName ?? "Founder",
      role: "founder",
      joinedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await houseRef.collection("chat").add({
      uid: house.founderId,
      displayName: leaderboardSeeds.find((p) => p.id === house.founderId)?.displayName ?? "Founder",
      text: `Welcome to ${house.name}!`,
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection("leaderboards").doc("houses").collection("entries").doc(house.id).set({
      displayName: house.name,
      photoURL: null,
      rating: house.houseRating,
      wins: house.memberCount * 10,
    }, { merge: true });
  }
  console.log(`Seeded ${houseSeeds.length} houses with members and chat.`);
}

async function seedDemoUsers() {
  const batch = db.batch();
  for (const entry of leaderboardSeeds) {
    const ref = db.collection("users").doc(entry.id);
    batch.set(ref, {
      displayName: entry.displayName,
      photoURL: entry.photoURL,
      email: null,
      rating: entry.rating,
      rankedWins: entry.wins,
      rankedLosses: Math.floor(entry.wins * 0.4),
      arenaCoins: Math.floor(entry.wins * 2),
      houseId: entry.id === "seed-player-1" ? "house-dragons" : entry.id === "seed-player-3" ? "house-phoenix" : null,
      onlineStatus: "offline",
      lastOnline: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
  console.log(`Seeded ${leaderboardSeeds.length} demo user profiles.`);
}

async function seedAcceptedFriends() {
  const pairs = [
    ["seed-player-1", "seed-player-2"],
    ["seed-player-3", "seed-player-4"],
    ["seed-player-5", "seed-player-6"],
  ];
  const batch = db.batch();
  for (const [a, b] of pairs) {
    const aProfile = leaderboardSeeds.find((p) => p.id === a);
    const bProfile = leaderboardSeeds.find((p) => p.id === b);
    if (!aProfile || !bProfile) continue;
    batch.set(db.collection("users").doc(a).collection("friends").doc(b), {
      friendId: b,
      displayName: bProfile.displayName,
      photoURL: null,
      since: FieldValue.serverTimestamp(),
      onlineStatus: "offline",
    });
    batch.set(db.collection("users").doc(b).collection("friends").doc(a), {
      friendId: a,
      displayName: aProfile.displayName,
      photoURL: null,
      since: FieldValue.serverTimestamp(),
      onlineStatus: "offline",
    });
  }
  await batch.commit();
  console.log("Seeded auto-accepted friend relationships.");
}

async function main() {
  console.log(`Seeding Firestore for project: ${projectId}`);
  await seedLeaderboards();
  await seedSeasonal();
  await seedHouses();
  await seedDemoUsers();
  await seedAcceptedFriends();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
