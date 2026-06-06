import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  createInitialSnapshot,
  evaluateMatchEnd,
  formatDropNotation,
  getEffectiveClock,
  getTeamForColorOnBoard,
  getValidDropSquares,
  parseDropNotation,
  reservePieceFromCapture,
  SEAT_CONFIG,
  startMatchClocks,
  tickPhysicalClock,
  validateDrop,
  type BughouseSnapshot,
} from "./bughouse-engine.ts";

describe("SEAT_CONFIG teams", () => {
  it("assigns official cross-board partners", () => {
    assert.equal(SEAT_CONFIG["board-a"].team, 1);
    assert.equal(SEAT_CONFIG["board-d"].team, 1);
    assert.equal(SEAT_CONFIG["board-c"].team, 2);
    assert.equal(SEAT_CONFIG["board-b"].team, 2);
    assert.equal(SEAT_CONFIG["board-a"].partnerBoardId, "board-d");
    assert.equal(SEAT_CONFIG["board-c"].partnerBoardId, "board-b");
  });

  it("maps colors to teams on each physical board", () => {
    assert.equal(getTeamForColorOnBoard("alpha", "w"), 1);
    assert.equal(getTeamForColorOnBoard("alpha", "b"), 2);
    assert.equal(getTeamForColorOnBoard("bravo", "w"), 2);
    assert.equal(getTeamForColorOnBoard("bravo", "b"), 1);
  });
});

describe("promoted piece capture", () => {
  it("returns pawn when a promoted piece is captured", () => {
    const piece = reservePieceFromCapture("q", "e8", { e8: true });
    assert.equal(piece, "p");
  });

  it("returns original type for non-promoted captures", () => {
    assert.equal(reservePieceFromCapture("n", "e5", {}), "n");
    assert.equal(reservePieceFromCapture("q", "d1", {}), "q");
  });
});

describe("drop notation", () => {
  it("formats and parses N@f7", () => {
    assert.equal(formatDropNotation("n", "f7"), "N@f7");
    assert.deepEqual(parseDropNotation("Q@h6"), { piece: "q", square: "h6" });
  });
});

describe("drop restrictions", () => {
  it("rejects pawn on rank 8", () => {
    const result = validateDrop("3k4/8/8/8/8/8/8/4K3 w - - 0 1", "p", "f8", "w", ["p"]);
    assert.equal(result.valid, false);
  });

  it("rejects drop that leaves own king in check", () => {
    const fen = "7k/8/8/8/8/2q5/8/4K3 w - - 0 1";
    const result = validateDrop(fen, "b", "h5", "w", ["b"]);
    assert.equal(result.valid, false);
  });

  it("allows drop that blocks check (Bd2)", () => {
    const fen = "7k/8/8/8/8/2q5/8/4K3 w - - 0 1";
    const result = validateDrop(fen, "b", "d2", "w", ["b"]);
    assert.equal(result.valid, true);
  });

  it("allows checkmate by drop Q@h6", () => {
    const fen = "6rk/5p2/8/8/8/8/8/4K3 b - - 0 1";
    const squares = getValidDropSquares(fen, ["q"], "b");
    assert.ok(squares.includes("h6"));
  });
});

describe("applyAction", () => {
  function snapshotWithAlpha(fen: string, overrides: Partial<BughouseSnapshot> = {}): BughouseSnapshot {
    const base = createInitialSnapshot();
    base.physical.alpha.fen = fen;
    base.physical.alpha.status = "active";
    return { ...base, ...overrides, physical: { ...base.physical, alpha: { ...base.physical.alpha, fen } } };
  }

  it("transfers captures to partner reserve on the other physical board", () => {
    const snap = createInitialSnapshot();
    snap.seats["board-a"].playerUid = "p1";
    snap.seats["board-d"].playerUid = "p2";
    const result = applyAction(snap, {
      type: "move",
      seatId: "board-a",
      move: "e2e4",
    });
    assert.equal(result.valid, true);
    assert.equal(result.snapshot!.seats["board-d"].reserve.length, 0);

    const afterCapture = applyAction(result.snapshot!, {
      type: "move",
      seatId: "board-c",
      move: "d7d5",
    });
    assert.equal(afterCapture.valid, true);

    const capture = applyAction(afterCapture.snapshot!, {
      type: "move",
      seatId: "board-a",
      move: "e4d5",
    });
    assert.equal(capture.valid, true);
    assert.deepEqual(capture.snapshot!.seats["board-d"].reserve, ["p"]);
  });

  it("ends match on drop checkmate", () => {
    const snap = snapshotWithAlpha("6rk/5p2/8/8/8/8/8/4K3 w - - 0 1");
    snap.seats["board-a"].reserve = ["q"];
    const result = applyAction(snap, {
      type: "drop",
      seatId: "board-a",
      piece: "q",
      square: "h6",
    });
    assert.equal(result.valid, true);
    assert.equal(result.matchEnded, true);
    assert.equal(result.winnerTeam, 1);
  });

  it("freezes board on stalemate without ending match", () => {
    const snap = snapshotWithAlpha("7k/5Q2/8/8/8/8/8/4K2q w - - 0 1");
    snap.seats["board-c"].reserve = [];
    const result = applyAction(snap, {
      type: "move",
      seatId: "board-a",
      move: "e1f1",
    });
    if (result.valid && result.physicalBoardFrozen) {
      assert.equal(result.matchEnded, undefined);
      assert.equal(result.physicalBoardFrozen, "alpha");
    }
  });

  it("rejects moves on frozen boards", () => {
    const snap = createInitialSnapshot();
    snap.physical.alpha.status = "stalemate";
    const result = applyAction(snap, {
      type: "move",
      seatId: "board-a",
      move: "e2e4",
    });
    assert.equal(result.valid, false);
  });
});

describe("evaluateMatchEnd", () => {
  it("detects time forfeit", () => {
    const snap = createInitialSnapshot();
    snap.physical.alpha.whiteClock = 0;
    const end = evaluateMatchEnd(snap);
    assert.equal(end.ended, true);
    assert.equal(end.reason, "time_forfeit");
    assert.equal(end.winnerTeam, 2);
  });
});

describe("physical board clocks", () => {
  it("starts both boards with White clocks running", () => {
    const snap = startMatchClocks(createInitialSnapshot(), 1_000);
    assert.equal(snap.physical.alpha.clockRunning, "w");
    assert.equal(snap.physical.bravo.clockRunning, "w");
    assert.equal(snap.physical.alpha.clockUpdatedAtMs, 1_000);
  });

  it("ticks White clock without a move", () => {
    const snap = startMatchClocks(createInitialSnapshot(), 0);
    const ticked = tickPhysicalClock(snap.physical.alpha, 5_000);
    assert.equal(ticked.whiteClock, 295);
    assert.equal(ticked.blackClock, 300);
    assert.equal(ticked.clockRunning, "w");
  });

  it("switches to Black clock after White moves", () => {
    let snap = startMatchClocks(createInitialSnapshot(), 0);
    const result = applyAction(snap, { type: "move", seatId: "board-a", move: "e2e4" }, 3_000);
    assert.equal(result.valid, true);
    const alpha = result.snapshot!.physical.alpha;
    assert.equal(alpha.whiteClock, 297);
    assert.equal(alpha.blackClock, 300);
    assert.equal(alpha.clockRunning, "b");
  });

  it("computes effective clock with unsynced elapsed time", () => {
    const snap = startMatchClocks(createInitialSnapshot(), 0);
    const physical = snap.physical.alpha;
    assert.equal(getEffectiveClock(physical, "w", 4_000), 296);
    assert.equal(getEffectiveClock(physical, "b", 4_000), 300);
  });
});
