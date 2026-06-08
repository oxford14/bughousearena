import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions";
import { getFirebaseApp } from "./config";

let functions: Functions | null = null;
let emulatorConnected = false;

export function getFirebaseFunctions(): Functions {
  if (!functions) {
    functions = getFunctions(getFirebaseApp(), "us-central1");
    connectFunctionsEmulatorIfNeeded(functions);
  }
  return functions;
}

function connectFunctionsEmulatorIfNeeded(fn: Functions) {
  if (emulatorConnected || typeof window === "undefined") return;
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR !== "true") return;

  connectFunctionsEmulator(fn, "127.0.0.1", 5001);
  emulatorConnected = true;
}
