/**
 * Grant super admin (and admin) custom claims to a user by email.
 * Run: node scripts/set-super-admin.mjs oxfordgalawan@gmail.com
 * Optional: node scripts/set-super-admin.mjs <email> --revoke
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

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");

if (!email) {
  console.error("Usage: node scripts/set-super-admin.mjs <email> [--revoke]");
  process.exit(1);
}

async function main() {
  const user = await admin.auth().getUserByEmail(email);
  const existing = user.customClaims ?? {};
  const claims = revoke
    ? { ...existing, admin: false, superAdmin: false }
    : { ...existing, admin: true, superAdmin: true };

  await admin.auth().setCustomUserClaims(user.uid, claims);
  console.log(
    `${revoke ? "Revoked" : "Granted"} super admin for ${email} (${user.uid}).`
  );
  console.log("The user must sign out and back in (or refresh their token) to pick up the change.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
