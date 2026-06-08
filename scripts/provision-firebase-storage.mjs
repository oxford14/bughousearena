/**
 * Provisions the Firebase default Storage bucket for this project.
 * Run: node scripts/provision-firebase-storage.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const serviceAccountPath = path.join(root, "firebase-service-account.json");

const projectId = process.env.FIREBASE_PROJECT_ID ?? "bughousearena";
const location = process.env.FIREBASE_STORAGE_LOCATION ?? "US-CENTRAL1";

if (!fs.existsSync(serviceAccountPath)) {
  console.error("Missing firebase-service-account.json in project root.");
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

const auth = new GoogleAuth({
  credentials,
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase",
  ],
});

async function getAccessToken() {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Could not obtain access token.");
  return token.token;
}

async function api(pathSuffix, init = {}) {
  const token = await getAccessToken();
  const response = await fetch(`https://firebasestorage.googleapis.com/v1alpha/${pathSuffix}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { ok: response.ok, status: response.status, body };
}

async function main() {
  console.log(`Project: ${projectId}`);
  console.log(`Location: ${location}`);

  const existing = await api(`projects/${projectId}/defaultBucket`, { method: "GET" });
  if (existing.ok) {
    console.log("Default bucket already exists:");
    console.log(JSON.stringify(existing.body, null, 2));
    return;
  }

  console.log("Creating default Firebase Storage bucket…");
  const created = await api(`projects/${projectId}/defaultBucket`, {
    method: "POST",
    body: JSON.stringify({
      location,
      storageClass: "STANDARD",
    }),
  });

  if (!created.ok) {
    console.error("Failed to create bucket:", created.status, created.body);
    process.exit(1);
  }

  console.log("Default bucket created:");
  console.log(JSON.stringify(created.body, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
