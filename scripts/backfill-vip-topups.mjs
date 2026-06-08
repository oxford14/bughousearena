/**
 * Backfill users.totalTopUpCentavos from paid coinPurchases.
 * Run: node scripts/backfill-vip-topups.mjs
 */
import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const saPath = path.join(__dirname, "..", "firebase-service-account.json");

if (!fs.existsSync(saPath)) {
  console.error("Missing firebase-service-account.json");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, "utf8"))),
  });
}

const db = admin.firestore();

async function main() {
  const snap = await db.collection("coinPurchases").where("status", "==", "paid").get();
  const totals = new Map();

  for (const doc of snap.docs) {
    const data = doc.data();
    const uid = data.uid;
    const amount = data.amountCentavos ?? 0;
    if (!uid || amount <= 0) continue;
    totals.set(uid, (totals.get(uid) ?? 0) + amount);
  }

  console.log(`Updating ${totals.size} users from ${snap.size} paid purchases…`);

  let batch = db.batch();
  let ops = 0;

  for (const [uid, totalTopUpCentavos] of totals) {
    batch.set(
      db.collection("users").doc(uid),
      { totalTopUpCentavos },
      { merge: true }
    );
    ops += 1;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
