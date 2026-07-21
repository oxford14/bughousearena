import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applySingleBoardDrop,
  applySingleBoardMove,
  getStandardInitialFen,
  SINGLE_BOARD_ID,
  validateCrazyhouseDrop,
  validateStandardMove,
} from "./single-board-engine.ts";
import { findQueueCombo } from "./team-builder.ts";
import type { BoardDocument } from "../../types/firestore.ts";

function blankBoard(overrides: Partial<BoardDocument> = {}): BoardDocument {
  return {
    id: SINGLE_BOARD_ID,
    fen: getStandardInitialFen(),
    captured: [],
    turn: "w",
    lastMove: null,
    playerUid: "u1",
    partnerBoardId: "",
    team: 1,
    playerColor: "w",
    whiteClock: 300,
    blackClock: 300,
    clockRunning: null,
    isCheck: false,
    isGameOver: false,
    ...overrides,
  };
}

describe("single-board-engine", () => {
  it("validates a standard opening move", () => {
    const result = validateStandardMove(getStandardInitialFen(), "e2e4", "w");
    assert.equal(result.valid, true);
    assert.ok(result.fen?.includes(" w ") === false);
  });

  it("applies checkmate path for scholar-ish sequence ending", () => {
    // Fool's mate setup: black mates after 1.f3 e5 2.g4 Qh4#
    let board = blankBoard();
    let r = applySingleBoardMove({
      board,
      gameType: "standard",
      playerId: "u1",
      playerColor: "w",
      move: "f2f3",
    });
    assert.equal(r.ok, true);
    board = r.board!;

    r = applySingleBoardMove({
      board: { ...board, playerUid: "u2" },
      gameType: "standard",
      playerId: "u2",
      playerColor: "b",
      move: "e7e5",
    });
    assert.equal(r.ok, true);
    board = r.board!;

    r = applySingleBoardMove({
      board: { ...board, playerUid: "u1" },
      gameType: "standard",
      playerId: "u1",
      playerColor: "w",
      move: "g2g4",
    });
    assert.equal(r.ok, true);
    board = r.board!;

    r = applySingleBoardMove({
      board: { ...board, playerUid: "u2" },
      gameType: "standard",
      playerId: "u2",
      playerColor: "b",
      move: "d8h4",
    });
    assert.equal(r.ok, true);
    assert.equal(r.matchEnded, true);
    assert.equal(r.winnerTeam, 2);
    assert.equal(r.endReason, "checkmate");
  });

  it("allows crazyhouse drop onto empty square from pocket", () => {
    const fen = "8/8/8/8/8/8/4P3/4K2k w - - 0 1";
    const drop = validateCrazyhouseDrop(fen, "n", "e4", "w", ["n"]);
    assert.equal(drop.valid, true);

    const board = blankBoard({ fen, captured: ["n"], turn: "w" });
    const applied = applySingleBoardDrop({
      board,
      playerId: "u1",
      playerColor: "w",
      piece: "n",
      to: "e4",
    });
    assert.equal(applied.ok, true);
    assert.deepEqual(applied.board?.captured, []);
  });

  it("explodes adjacent non-pawns on atomic capture", () => {
    // White knight on e5 captures black pawn on d7 — should nuke pieces around d7.
    // Position: white Ne5, black Kd8, Rd7(pawn), Bd8 wait simpler:
    // White Nb1, Black: king e8, rook d8, pawn e7. Wait use clear FEN.
    // White knight on c3 captures black knight on d5; adjacent rook on e5 and pawn on d4.
    // After Nxd5: remove Nc3(capturer on d5), Nd5, and adjacent non-pawns: if Re4, Be6, pawns immune.
    const fen = "4k3/8/8/3n4/4R3/2N5/8/4K3 w - - 0 1";
    // White Nc3xd5: explosion at d5 removes Nc3+Nd5 and adjacent Re4 (e4 is adjacent to d5).
    const board = blankBoard({ fen, turn: "w" });
    const applied = applySingleBoardMove({
      board,
      gameType: "atomic",
      playerId: "u1",
      playerColor: "w",
      move: "c3d5",
    });
    assert.equal(applied.ok, true);
    assert.ok(applied.board?.fen);
    const after = applied.board!.fen.split(" ")[0]!;
    // Knight and rook should be gone; king still there
    assert.equal(after.includes("N") || after.includes("n"), false);
    assert.equal(after.includes("R") || after.includes("r"), false);
    assert.ok(after.includes("k") && after.includes("K"));
  });

  it("wins atomic by exploding the enemy king", () => {
    // Black king e8, black knight e7, white rook h7 captures Ne7 → explosion kills Ke8.
    const fen = "4k3/4n2R/8/8/8/8/8/4K3 w - - 0 1";
    const board = blankBoard({ fen, turn: "w" });
    const applied = applySingleBoardMove({
      board,
      gameType: "atomic",
      playerId: "u1",
      playerColor: "w",
      move: "h7e7",
    });
    assert.equal(applied.ok, true);
    assert.equal(applied.matchEnded, true);
    assert.equal(applied.winnerTeam, 1);
    assert.equal(applied.endReason, "explosion");
  });

  it("rejects atomic captures that explode own king", () => {
    // White king e1, white knight e2 captures black piece on e3? explosion kills own king.
    // Black pawn e3, white Ne2, white Ke1. Nxe3 explodes Ke1.
    const fen = "4k3/8/8/8/8/4p3/4N3/4K3 w - - 0 1";
    const board = blankBoard({ fen, turn: "w" });
    const applied = applySingleBoardMove({
      board,
      gameType: "atomic",
      playerId: "u1",
      playerColor: "w",
      move: "e2e3",
    });
    assert.equal(applied.ok, false);
  });
});

describe("findQueueCombo slots", () => {
  it("fills 2 slots for 1v1", () => {
    const entries = [
      { id: "a", members: [{ uid: "1", displayName: "A", photoURL: null, rating: 1200 }] },
      { id: "b", members: [{ uid: "2", displayName: "B", photoURL: null, rating: 1200 }] },
    ];
    const combo = findQueueCombo(entries, "a", 2);
    assert.ok(combo);
    assert.equal(combo!.length, 2);
  });
});
