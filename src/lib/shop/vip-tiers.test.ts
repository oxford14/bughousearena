import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getVipLevel, getVipTier } from "./vip-tiers.ts";

describe("vip tiers", () => {
  it("starts at member tier with no top-up", () => {
    assert.equal(getVipLevel(0), 0);
    assert.equal(getVipTier(0).name, "Member");
  });

  it("promotes based on lifetime top-up centavos", () => {
    assert.equal(getVipLevel(2_900), 1);
    assert.equal(getVipLevel(9_900), 2);
    assert.equal(getVipLevel(39_900), 3);
    assert.equal(getVipLevel(149_900), 5);
    assert.equal(getVipLevel(500_000), 6);
  });
});
