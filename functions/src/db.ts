import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function getDb() {
  if (!getApps().length) {
    initializeApp();
  }
  return getFirestore();
}
