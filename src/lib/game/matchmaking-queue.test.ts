import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveQueueMembers } from "./queue-members.ts";
import type { PartyDocument, UserProfile } from "@/types/firestore.ts";

const user = {
  uid: "leader",
  displayName: "Leader",
  photoURL: null,
  rating: 1400,
} as UserProfile;

const party = {
  id: "party-1",
  leaderUid: "leader",
  code: "ABC123",
  members: [
    { uid: "leader", displayName: "Leader", photoURL: null, rating: 1400 },
    { uid: "partner", displayName: "Partner", photoURL: null, rating: 1300 },
  ],
  memberUids: ["leader", "partner"],
  readyUids: [],
} as PartyDocument;

describe("resolveQueueMembers", () => {
  it("queues only the requesting user when partner is not ready", () => {
    const members = resolveQueueMembers(user, party);
    assert.equal(members.length, 1);
    assert.equal(members[0]?.uid, "leader");
  });

  it("includes ready party partners", () => {
    const members = resolveQueueMembers(user, {
      ...party,
      readyUids: ["partner"],
    });
    assert.deepEqual(
      members.map((m) => m.uid).sort(),
      ["leader", "partner"]
    );
  });

  it("queues solo when not in a party", () => {
    const members = resolveQueueMembers(user, null);
    assert.equal(members.length, 1);
    assert.equal(members[0]?.uid, "leader");
  });
});
