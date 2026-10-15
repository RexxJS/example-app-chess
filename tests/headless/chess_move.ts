// app/chess/move.ts: the QUnit "Move" case of src/test.js, then every kind
// of move unpacked, and its text (long algebraic and coordinate).
import { Move, Kind } from "./chess/move.ts";
import { Piece, getIndexFromAlgebraic as sq } from "./chess/chess.ts";
import { eq } from "./lib/check.ts";

const move = new Move(32, 33, Kind.CAPTURE, Piece.ROOK, Piece.QUEEN);
eq("from, to, kind, piece", [move.getFrom(), move.getTo(), move.getKind(), move.getPiece()], [32, 33, Kind.CAPTURE, Piece.ROOK]);
eq("a capture of a queen, no promotion, no castle, taken on the square moved to", [move.isCapture(), move.getCapturedPiece(), move.isPromotion(), move.isCastle(), move.getCaptureSquare()], [true, Piece.QUEEN, false, false, 33]);

// Every field packed and unpacked, at the extremes.
const far = new Move(63, 0, Kind.QUEEN_PROMOTION_CAPTURE, Piece.PAWN, Piece.ROOK);
eq("the corners and the highest kind", [far.getFrom(), far.getTo(), far.getKind(), far.getPiece(), far.getCapturedPiece(), far.getPromotedPiece()], [63, 0, 15, Piece.PAWN, Piece.ROOK, Piece.QUEEN]);
eq("a null capture is stored as pawn", new Move(1, 2, Kind.POSITIONAL, Piece.KNIGHT, null).getCapturedPiece(), Piece.PAWN);
eq("the promoted piece of each promotion kind", [Kind.KNIGHT_PROMOTION, Kind.BISHOP_PROMOTION, Kind.ROOK_PROMOTION, Kind.QUEEN_PROMOTION_CAPTURE].map((k) => new Move(48, 56, k, Piece.PAWN, Piece.ROOK).getPromotedPiece()),
  [Piece.KNIGHT, Piece.BISHOP, Piece.ROOK, Piece.QUEEN]);
eq("and pawn for a move that is none", new Move(12, 28, Kind.DOUBLE_PAWN_PUSH, Piece.PAWN, null).getPromotedPiece(), Piece.PAWN);
eq("castles", [new Move(4, 6, Kind.KING_CASTLE, Piece.KING, null).isCastle(), new Move(4, 2, Kind.QUEEN_CASTLE, Piece.KING, null).isCastle(), new Move(4, 5, Kind.POSITIONAL, Piece.KING, null).isCastle()], [true, true, false]);
eq("en passant: white's e5xd6 takes on d5, black's d4xe3 takes on e4",
  [new Move(sq("e5"), sq("d6"), Kind.EN_PASSANT_CAPTURE, Piece.PAWN, Piece.PAWN).getCaptureSquare(), new Move(sq("d4"), sq("e3"), Kind.EN_PASSANT_CAPTURE, Piece.PAWN, Piece.PAWN).getCaptureSquare()], [sq("d5"), sq("e4")]);
eq("which kinds capture", [Kind.CAPTURE, Kind.EN_PASSANT_CAPTURE, Kind.KNIGHT_PROMOTION_CAPTURE, Kind.POSITIONAL, Kind.QUEEN_PROMOTION, Kind.KING_CASTLE].map((k) => new Move(0, 1, k, Piece.PAWN, null).isCapture()), [true, true, true, false, false, false]);
eq("equal when the same move", [move.isEqual(new Move(32, 33, Kind.CAPTURE, Piece.ROOK, Piece.QUEEN)), move.isEqual(far)], [true, false]);

// Text.
const text = (m: Move) => [m.getString(), m.getCoordinate()];
eq("a pawn push", text(new Move(sq("e2"), sq("e4"), Kind.DOUBLE_PAWN_PUSH, Piece.PAWN, null)), ["e2-e4", "e2e4"]);
eq("a knight move", text(new Move(sq("g1"), sq("f3"), Kind.POSITIONAL, Piece.KNIGHT, null)), ["Ng1-f3", "g1f3"]);
eq("a capture", text(new Move(sq("e4"), sq("d5"), Kind.CAPTURE, Piece.PAWN, Piece.PAWN)), ["e4xd5", "e4d5"]);
eq("en passant", text(new Move(sq("e5"), sq("d6"), Kind.EN_PASSANT_CAPTURE, Piece.PAWN, Piece.PAWN)), ["e5xd6e.p.", "e5d6"]);
eq("a promotion, and one with a capture", [text(new Move(sq("e7"), sq("e8"), Kind.QUEEN_PROMOTION, Piece.PAWN, null)), text(new Move(sq("b7"), sq("a8"), Kind.KNIGHT_PROMOTION_CAPTURE, Piece.PAWN, Piece.ROOK))], [["e7-e8Q", "e7e8q"], ["b7xa8N", "b7a8n"]]);
eq("castles", [text(new Move(sq("e1"), sq("g1"), Kind.KING_CASTLE, Piece.KING, null)), text(new Move(sq("e8"), sq("c8"), Kind.QUEEN_CASTLE, Piece.KING, null))], [["0-0", "e1g1"], ["0-0-0", "e8c8"]]);

// expect: ok from, to, kind, piece
// expect: ok a capture of a queen, no promotion, no castle, taken on the square moved to
// expect: ok the corners and the highest kind
// expect: ok a null capture is stored as pawn
// expect: ok the promoted piece of each promotion kind
// expect: ok and pawn for a move that is none
// expect: ok castles
// expect: ok en passant: white's e5xd6 takes on d5, black's d4xe3 takes on e4
// expect: ok which kinds capture
// expect: ok equal when the same move
// expect: ok a pawn push
// expect: ok a knight move
// expect: ok a capture
// expect: ok en passant
// expect: ok a promotion, and one with a capture
// expect: ok castles
