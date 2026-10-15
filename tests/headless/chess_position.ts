// app/chess/position.ts: the QUnit "Position", "Perft" and "Hashing" cases
// of src/test.js, then perft from the standard test positions
// (chessprogramming.org's Perft Results: Kiwipete and positions 3 to 6),
// node counts exact; make and unmake leaving every field as it was; the
// status in each of its states; captures-only generation.
import { Position, Status } from "./chess/position.ts";
import { Move, Kind } from "./chess/move.ts";
import { Piece, PieceColor, getIndexFromAlgebraic as sq } from "./chess/chess.ts";
import { setUp } from "./lib/setup.ts";
import { eq } from "./lib/check.ts";

const position = new Position();
eq("16 pawns at the start", position.getPieceBitboard(Piece.PAWN).popcnt(), 16);
eq("20 moves at the start, none a capture", [position.getMoves().length, position.getMoves(false, true).length, position.getMoves(true).length], [20, 0, 20]);

// Perft from the start: the QUnit case (3 and 4) and 1 and 2.
eq("perft 1-3 from the start", [position.perft(1), position.perft(2), position.perft(3)], [20, 400, 8902]);
eq("perft 4 from the start", position.perft(4), 197281);

// The standard test positions.
const kiwipete = () => setUp("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R", "w", "KQkq");
eq("Kiwipete: perft 1-3", [kiwipete().perft(1), kiwipete().perft(2), kiwipete().perft(3)], [48, 2039, 97862]);
const pos3 = () => setUp("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8", "w");
eq("position 3 (en passant, pins): perft 1-4", [pos3().perft(1), pos3().perft(2), pos3().perft(3), pos3().perft(4)], [14, 191, 2812, 43238]);
const pos4 = () => setUp("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1", "w", "kq");
eq("position 4 (promotions, a rook taken off its square): perft 1-3", [pos4().perft(1), pos4().perft(2), pos4().perft(3)], [6, 264, 9467]);
const pos5 = () => setUp("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R", "w", "KQ");
eq("position 5: perft 1-3", [pos5().perft(1), pos5().perft(2), pos5().perft(3)], [44, 1486, 62379]);
const pos6 = () => setUp("r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1", "w");
eq("position 6: perft 1-3", [pos6().perft(1), pos6().perft(2), pos6().perft(3)], [46, 2079, 89890]);
const epPos = () => setUp("8/8/8/2k5/3Pp3/8/8/4K3", "b", "-", "d3");
eq("en passant from a set-up square: the capture is there and taken", [epPos().getMoves().filter((m) => m.getKind() === Kind.EN_PASSANT_CAPTURE).map((m) => m.getString()), epPos().perft(1)], [["e4xd3e.p."], 9]);

// Hashing: the key kept move by move equals the key from scratch.
const checkPositionHash = (p: Position) => {
  const old = p.hashKey.dup();
  p.updateHashKey();
  return p.hashKey.isEqual(old);
};
const p = new Position();
eq("the start hashes alike kept and from scratch", checkPositionHash(p), true);
const startKey = p.hashKey.dup();
p.makeMove(p.getMoves(true)[0]);
eq("after a move: kept equals from scratch, and differs from the start", [checkPositionHash(p), p.hashKey.isEqual(startKey), p.canUndo()], [true, false, true]);
p.unmakeMove();
eq("unmade: the start's key again", [checkPositionHash(p), p.hashKey.isEqual(startKey), p.canUndo()], [true, true, false]);

// Make and unmake through every kind of move leaves the position as it was.
const snapshot = (q: Position) => JSON.stringify([q.bitboards, q.pieces, q.turn, q.castlingRights, q.enPassantSquare, q.halfmoveClock, q.fullmoveNumber, q.hashKey, q.madeMoves.length, q.hashHistory.length]);
const kinds = new Set<number>();
let hashOk = true;
let asBefore = true;
// Two plies of each: Kiwipete (castles, en passant after a double push),
// position 4 (black's b2 pawn promotes, taking the a1 rook or not).
for (const q of [kiwipete(), pos4()]) {
  const before = snapshot(q);
  for (const m of q.getMoves(true)) {
    if (!q.makeMove(m)) continue;
    kinds.add(m.getKind());
    hashOk = hashOk && checkPositionHash(q);
    for (const m2 of q.getMoves(true)) {
      if (q.makeMove(m2)) { kinds.add(m2.getKind()); hashOk = hashOk && checkPositionHash(q); q.unmakeMove(); }
    }
    q.unmakeMove();
  }
  asBefore = asBefore && snapshot(q) === before;
}
eq("Kiwipete and position 4, every move made and unmade two deep: the position as before, the hash right throughout, castles, captures, en passant, promotions among them",
  [asBefore, hashOk, [...kinds].sort((a, b) => a - b)], [true, true, [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15]]);

// The clocks and the rights.
const play = (q: Position, ...coords: string[]) => {
  for (const c of coords) {
    const m = q.getMoves().find((x) => x.getCoordinate() === c);
    if (!m) throw new Error(`no move ${c}`);
    q.makeMove(m);
  }
  return q;
};
const clock = play(new Position(), "g1f3", "g8f6", "f3g1", "g8f6".replace("g8f6", "f6g8"));
eq("the halfmove clock counts quiet moves, the fullmove number black's", [clock.halfmoveClock, clock.fullmoveNumber], [4, 3]);
play(clock, "e2e4");
eq("a pawn move resets the clock", [clock.halfmoveClock, clock.enPassantSquare], [0, sq("e4")]);
clock.unmakeMove();
eq("unmade: the clock is back (the old engine lost it), and the en passant square", [clock.halfmoveClock, clock.enPassantSquare], [4, -1]);
const rights = play(new Position(), "e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6");
eq("white may castle king side, and does", [rights.canCastle(PieceColor.WHITE, true, true), rights.getMoves().some((m) => m.getKind() === Kind.KING_CASTLE)], [true, true]);
play(rights, "e1g1");
eq("after castling: the king on g1, the rook on f1, white's rights gone, black's kept", [rights.getPieceAtOrNull(sq("g1")), rights.getPieceAtOrNull(sq("f1")), rights.castlingRights], [Piece.KING, Piece.ROOK, 2 | 8]);
rights.unmakeMove();
eq("unmade: the rook home and the rights back", [rights.getPieceAtOrNull(sq("h1")), rights.getPieceAtOrNull(sq("e1")), rights.castlingRights], [Piece.ROOK, Piece.KING, 15]);
const rookTaken = play(setUp("r3k2r/8/8/8/8/8/8/R3K2R", "w", "KQkq"), "a1a8");
eq("a rook taken on its home square takes that right with it; the mover's own goes too", rookTaken.castlingRights, 1 | 2);

// Status.
eq("the start is normal", new Position().getStatus(), Status.NORMAL);
eq("fool's mate: checkmate, in check, no moves", (() => { const q = play(new Position(), "f2f3", "e7e5", "g2g4", "d8h4"); return [q.getStatus(), q.isKingInCheck(), q.getMoves().length]; })(), [Status.CHECKMATE, true, 0]);
eq("a check with moves left is check", play(new Position(), "e2e4", "f7f5", "d1h5").getStatus(), Status.CHECK);
eq("stalemate", setUp("7k/5Q2/6K1/8/8/8/8/8", "b").getStatus(), Status.STALEMATE_DRAW);
const fifty = new Position();
fifty.halfmoveClock = 100;
eq("the fifty-move rule at 100 half-moves", [fifty.getStatus(), fifty.isDraw()], [Status.FIFTY_MOVE_RULE_DRAW, true]);
const rep = play(new Position(), "g1f3", "g8f6", "f3g1", "f6g8");
eq("the start seen twice is no draw yet", [rep.getStatus(), rep.isThreefoldRepetitionRuleDraw()], [Status.NORMAL, false]);
play(rep, "g1f3", "g8f6", "f3g1", "f6g8");
eq("seen three times: threefold repetition (the old engine waited for a fourth)", [rep.getStatus(), rep.isDraw()], [Status.THREEFOLD_REPETITION_RULE_DRAW, true]);
eq("insufficient material: K v K, KB v K, KN v K, KB v KB on one colour", [
  setUp("4k3/8/8/8/8/8/8/4K3").getStatus(), setUp("4k3/8/8/8/8/8/8/2B1K3").getStatus(), setUp("4k3/8/8/8/8/8/8/1N2K3").getStatus(), setUp("2b1k3/8/8/8/8/8/8/4KB2").getStatus(),
], [Status.INSUFFICIENT_MATERIAL_DRAW, Status.INSUFFICIENT_MATERIAL_DRAW, Status.INSUFFICIENT_MATERIAL_DRAW, Status.INSUFFICIENT_MATERIAL_DRAW]);
eq("but not with a pawn, a rook, two knights, or bishops on both colours", [
  setUp("4k3/8/8/8/8/8/4P3/4K3").getStatus(), setUp("4k3/8/8/8/8/8/8/R3K3").getStatus(), setUp("4k3/8/8/8/8/8/8/1NN1K3").getStatus(), setUp("1b2k3/8/8/8/8/8/8/4KB2").getStatus(),
], [Status.NORMAL, Status.NORMAL, Status.NORMAL, Status.NORMAL]);

// Captures only.
const cap = kiwipete();
eq("captures only: 8 of Kiwipete's 48 take something, every one a capture", [cap.getMoves(false, true).length, cap.getMoves(false, true).every((m) => m.isCapture())], [8, true]);
eq("a pseudo-legal move that leaves the king in check is refused by makeMove, and nothing changes", (() => {
  const q = setUp("4k3/8/8/8/8/8/4r3/4KB2", "w", "-");
  const before = snapshot(q);
  const bishop = q.getMoves(true).find((m) => m.getPiece() === Piece.BISHOP && m.getTo() === sq("g2"))!;
  return [q.makeMove(bishop), snapshot(q) === before, q.getMoves().map((m) => m.getString())];
})(), [false, true, ["Bf1xe2", "Ke1-d1", "Ke1xe2"]]);
eq("getLastMove and the set-up helpers", [new Position().getLastMove(), play(new Position(), "e2e4").getLastMove()!.getCoordinate(), Position.empty().getOccupiedBitboard().isEmpty(), Position.empty().putPiece(Piece.QUEEN, PieceColor.BLACK, 0).getColorAtOrNull(0), Position.empty().getColorAtOrNull(0)],
  [null, "e2e4", true, PieceColor.BLACK, null]);

// expect: ok 16 pawns at the start
// expect: ok 20 moves at the start, none a capture
// expect: ok perft 1-3 from the start
// expect: ok perft 4 from the start
// expect: ok Kiwipete: perft 1-3
// expect: ok position 3 (en passant, pins): perft 1-4
// expect: ok position 4 (promotions, a rook taken off its square): perft 1-3
// expect: ok position 5: perft 1-3
// expect: ok position 6: perft 1-3
// expect: ok en passant from a set-up square: the capture is there and taken
// expect: ok the start hashes alike kept and from scratch
// expect: ok after a move: kept equals from scratch, and differs from the start
// expect: ok unmade: the start's key again
// expect: ok Kiwipete and position 4, every move made and unmade two deep: the position as before, the hash right throughout, castles, captures, en passant, promotions among them
// expect: ok the halfmove clock counts quiet moves, the fullmove number black's
// expect: ok a pawn move resets the clock
// expect: ok unmade: the clock is back (the old engine lost it), and the en passant square
// expect: ok white may castle king side, and does
// expect: ok after castling: the king on g1, the rook on f1, white's rights gone, black's kept
// expect: ok unmade: the rook home and the rights back
// expect: ok a rook taken on its home square takes that right with it; the mover's own goes too
// expect: ok the start is normal
// expect: ok fool's mate: checkmate, in check, no moves
// expect: ok a check with moves left is check
// expect: ok stalemate
// expect: ok the fifty-move rule at 100 half-moves
// expect: ok the start seen twice is no draw yet
// expect: ok seen three times: threefold repetition (the old engine waited for a fourth)
// expect: ok insufficient material: K v K, KB v K, KN v K, KB v KB on one colour
// expect: ok but not with a pawn, a rook, two knights, or bishops on both colours
// expect: ok captures only: 8 of Kiwipete's 48 take something, every one a capture
// expect: ok a pseudo-legal move that leaves the king in check is refused by makeMove, and nothing changes
// expect: ok getLastMove and the set-up helpers
