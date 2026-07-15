import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCrazyhouseFen,
  buildCrazyhousePocket,
  markPromotedSquares,
  parseEngineBestMove,
} from "./crazyhouse-fen.ts";

const START =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("buildCrazyhousePocket", () => {
  it("uppercases pocket pieces when white to move", () => {
    assert.equal(buildCrazyhousePocket(["n", "p", "q"], "w"), "[NPQ]");
  });

  it("lowercases pocket pieces when black to move", () => {
    assert.equal(buildCrazyhousePocket(["n", "b"], "b"), "[bn]");
  });

  it("returns empty string for empty reserve", () => {
    assert.equal(buildCrazyhousePocket([], "w"), "");
  });
});

describe("markPromotedSquares", () => {
  it("appends ~ to promoted piece on its square", () => {
    const placement = "4Q3/8/8/8/8/8/8/4k3";
    assert.equal(
      markPromotedSquares(placement, ["e8"]),
      "4Q~3/8/8/8/8/8/8/4k3"
    );
  });
});

describe("buildCrazyhouseFen", () => {
  it("builds starting position without pocket", () => {
    assert.equal(buildCrazyhouseFen(START, [], []), START);
  });

  it("appends pocket for side to move", () => {
    const fen = buildCrazyhouseFen(START, ["n"], []);
    assert.equal(
      fen,
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[N] w KQkq - 0 1"
    );
  });

  it("marks promoted squares and pocket together", () => {
    const base = "4Q3/8/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1";
    const fen = buildCrazyhouseFen(base, ["p"], ["e8"]);
    assert.equal(
      fen,
      "4Q~3/8/8/8/8/8/PPPPPPPP/RNBQKBNR[p] b KQkq - 0 1"
    );
  });
});

describe("parseEngineBestMove", () => {
  it("parses regular moves", () => {
    assert.deepEqual(parseEngineBestMove("e2e4"), { move: "e2e4" });
  });

  it("parses promotion moves", () => {
    assert.deepEqual(parseEngineBestMove("e7e8q"), {
      move: "e7e8",
      promotion: "q",
    });
  });

  it("parses drop moves", () => {
    assert.deepEqual(parseEngineBestMove("N@f3"), {
      move: "drop:n@f3",
    });
  });

  it("returns null for no move", () => {
    assert.equal(parseEngineBestMove("(none)"), null);
    assert.equal(parseEngineBestMove(""), null);
  });
});
