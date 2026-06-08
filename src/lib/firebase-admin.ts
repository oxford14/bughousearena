import * as admin from "firebase-admin";
import fs from "fs";
import path from "path";

function getProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    "bughousearena"
  );
}

function isCloudRuntime(): boolean {
  return Boolean(
    process.env.K_SERVICE ||
      process.env.FIREBASE_CONFIG ||
      process.env.GCLOUD_PROJECT ||
      process.env.FUNCTIONS_EMULATOR
  );
}

const DEFAULT_SERVICE_ACCOUNT_FILE = path.join(
  process.cwd(),
  "firebase-service-account.json"
);

function unquoteEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\n/g, "\n");
  }
  return trimmed.replace(/\\n/g, "\n");
}

function normalizeServiceAccount(
  account: admin.ServiceAccount
): admin.ServiceAccount {
  if (typeof account.privateKey === "string") {
    account.privateKey = account.privateKey.replace(/\\n/g, "\n");
  }
  return account;
}

function loadServiceAccountFromFile(filePath: string): admin.ServiceAccount {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  const fileContents = fs.readFileSync(resolved, "utf8");
  return normalizeServiceAccount(JSON.parse(fileContents) as admin.ServiceAccount);
}

function findServiceAccountFileInRoot(): string | null {
  try {
    const root = process.cwd();
    for (const name of fs.readdirSync(root)) {
      if (!name.endsWith(".json")) continue;
      if (
        name === "firebase-service-account.json" ||
        name.includes("firebase-adminsdk")
      ) {
        return path.join(root, name);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function loadFromInlineCredentials(): admin.ServiceAccount | null {
  const inlineJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ??
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!inlineJson) return null;

  const value = unquoteEnvValue(inlineJson);

  if (value.startsWith("{")) {
    try {
      return normalizeServiceAccount(JSON.parse(value) as admin.ServiceAccount);
    } catch {
      return null;
    }
  }

  if (value.includes("BEGIN PRIVATE KEY")) {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    if (!clientEmail) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY contains a private key only. Also set FIREBASE_CLIENT_EMAIL (from your service account JSON), or use firebase-service-account.json with the full JSON file."
      );
    }
    return {
      projectId: getProjectId(),
      clientEmail,
      privateKey: value,
    };
  }

  if (value.endsWith(".json")) {
    const resolved = path.isAbsolute(value)
      ? value
      : path.join(process.cwd(), value);
    if (fs.existsSync(resolved)) {
      return loadServiceAccountFromFile(resolved);
    }
  }

  return null;
}

function loadServiceAccountFromEnv(): admin.ServiceAccount | null {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credentialsPath && fs.existsSync(credentialsPath)) {
    return loadServiceAccountFromFile(credentialsPath);
  }

  if (fs.existsSync(DEFAULT_SERVICE_ACCOUNT_FILE)) {
    return loadServiceAccountFromFile(DEFAULT_SERVICE_ACCOUNT_FILE);
  }

  const discovered = findServiceAccountFileInRoot();
  if (discovered) {
    return loadServiceAccountFromFile(discovered);
  }

  return loadFromInlineCredentials();
}

function initFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const serviceAccount = loadServiceAccountFromEnv();
  if (serviceAccount) {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: getProjectId(),
    });
  }

  if (isCloudRuntime()) {
    return admin.initializeApp({ projectId: getProjectId() });
  }

  throw new Error(
    "Firebase Admin is not configured. Add firebase-service-account.json to the project root, set GOOGLE_APPLICATION_CREDENTIALS, or set FIREBASE_SERVICE_ACCOUNT_JSON to the full service account JSON."
  );
}

export function getAdminDb() {
  initFirebaseAdmin();
  return admin.firestore();
}

export function getAdminAuth() {
  initFirebaseAdmin();
  return admin.auth();
}

export function isFirebaseAdminConfigured(): boolean {
  try {
    loadServiceAccountFromEnv();
    return true;
  } catch {
    return false;
  }
}
