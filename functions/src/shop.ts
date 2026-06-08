import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import { getDb } from "./db";
import { getCoinPack } from "./coin-packs";
import {
  attachCheckoutSession,
  createPendingPurchase,
  findPurchaseIdFromWebhook,
  fulfillPurchase,
} from "./purchases";
import {
  createPaymongoCheckoutSession,
  parsePaymongoWebhookEvent,
  verifyPaymongoSignature,
} from "./paymongo";

export const createCoinCheckout = onCall(
  {
    secrets: ["PAYMONGO_SECRET_KEY"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { packId } = request.data as { packId?: string };
    if (!packId || typeof packId !== "string") {
      throw new HttpsError("invalid-argument", "packId is required.");
    }

    const pack = getCoinPack(packId);
    if (!pack) {
      throw new HttpsError("invalid-argument", "Unknown coin pack.");
    }

    const db = getDb();
    const uid = request.auth.uid;
    const { purchaseId, referenceNumber } = await createPendingPurchase(
      db,
      uid,
      pack
    );

    try {
      const session = await createPaymongoCheckoutSession({
        pack,
        purchaseId,
        referenceNumber,
        uid,
        billingEmail: request.auth.token.email ?? undefined,
        billingName: request.auth.token.name ?? undefined,
      });

      await attachCheckoutSession(db, purchaseId, session.checkoutSessionId);

      return {
        checkoutUrl: session.checkoutUrl,
        purchaseId,
      };
    } catch (error) {
      await db.collection("coinPurchases").doc(purchaseId).update({
        status: "failed",
      });
      const message =
        error instanceof Error ? error.message : "Checkout failed.";
      throw new HttpsError("internal", message);
    }
  }
);

export const getCoinPurchaseStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { purchaseId } = request.data as { purchaseId?: string };
  if (!purchaseId || typeof purchaseId !== "string") {
    throw new HttpsError("invalid-argument", "purchaseId is required.");
  }

  const snap = await getDb().collection("coinPurchases").doc(purchaseId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Purchase not found.");
  }

  const data = snap.data()!;
  if (data.uid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Not your purchase.");
  }

  return {
    status: data.status as string,
    coins: (data.coinsCredited as number | undefined) ?? (data.coins as number),
    baseCoins: data.coins as number,
    bonusCoins: (data.bonusCoins as number | undefined) ?? 0,
    packId: data.packId as string,
  };
});

export const paymongoWebhook = onRequest(
  {
    secrets: ["PAYMONGO_WEBHOOK_SECRET"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      res.status(400).send("Missing raw body");
      return;
    }

    const signature = req.get("Paymongo-Signature") ?? req.get("paymongo-signature");
    if (!verifyPaymongoSignature(rawBody, signature)) {
      res.status(401).send("Invalid signature");
      return;
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch {
      res.status(400).send("Invalid JSON");
      return;
    }

    const event = parsePaymongoWebhookEvent(body);
    if (!event) {
      res.status(200).send("Ignored");
      return;
    }

    if (event.type !== "checkout_session.payment.paid") {
      res.status(200).send("Ignored");
      return;
    }

    const db = getDb();
    const purchaseId = await findPurchaseIdFromWebhook(
      db,
      event.metadata,
      event.referenceNumber
    );

    if (!purchaseId) {
      console.warn("PayMongo webhook: purchase not found", event);
      res.status(200).send("Purchase not found");
      return;
    }

    try {
      await fulfillPurchase(db, purchaseId);
      res.status(200).send("OK");
    } catch (error) {
      console.error("PayMongo webhook fulfillment failed", error);
      res.status(500).send("Fulfillment failed");
    }
  }
);
