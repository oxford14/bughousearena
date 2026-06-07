import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_THEMES,
  DEFAULT_BOARD_THEME_ID,
  isBoardThemeId,
} from "./board-themes.ts";

describe("board themes", () => {
  it("defaults to arena", () => {
    assert.equal(DEFAULT_BOARD_THEME_ID, "arena");
  });

  it("validates theme ids", () => {
    assert.equal(isBoardThemeId("classic"), true);
    assert.equal(isBoardThemeId("arena"), true);
    assert.equal(isBoardThemeId("forest"), true);
    assert.equal(isBoardThemeId("neon"), false);
  });

  it("classic colors differ from arena", () => {
    assert.notEqual(BOARD_THEMES.classic.darkSquare, BOARD_THEMES.arena.darkSquare);
    assert.notEqual(BOARD_THEMES.classic.lightSquare, BOARD_THEMES.arena.lightSquare);
  });
});
