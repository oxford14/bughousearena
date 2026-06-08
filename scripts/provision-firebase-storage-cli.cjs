/**
 * Creates the Firebase default Storage bucket using your Firebase CLI login.
 * Run: node scripts/provision-firebase-storage-cli.cjs
 */
const auth = require("firebase-tools/lib/auth");

const projectId = process.env.FIREBASE_PROJECT_ID ?? "bughousearena";
const location = process.env.FIREBASE_STORAGE_LOCATION ?? "US-CENTRAL1";

async function api(pathSuffix, init = {}) {
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error("Run `npx firebase-tools@latest login` first.");
  }

  const token = await auth.getAccessToken(account.tokens.refresh_token, [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase",
  ]);

  const response = await fetch(
    `https://firebasestorage.googleapis.com/v1alpha/${pathSuffix}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    }
  );

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

  const existing = await api(`projects/${projectId}/defaultBucket`, { method: "GET" });
  if (existing.ok) {
    console.log("Default bucket already exists:");
    console.log(JSON.stringify(existing.body, null, 2));
    return;
  }

  console.log("Creating default Firebase Storage bucket…");
  const created = await api(`projects/${projectId}/defaultBucket`, {
    method: "POST",
    body: JSON.stringify({ location, storageClass: "STANDARD" }),
  });

  if (!created.ok) {
    console.error("Failed:", created.status, created.body);
    process.exit(1);
  }

  console.log("Success:");
  console.log(JSON.stringify(created.body, null, 2));
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
