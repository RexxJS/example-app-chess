// app/chess/zobrist.ts: the QUnit "Zobrist" case of src/test.js, then
// that an update undoes itself, that the same state reached two ways
// hashes alike, that different states differ, and that the table is the
// same every run (seeded).
import { Zobrist, RANDOM_VALUES, createRandomValues } from "./chess/zobrist.ts";
import { Bitboard } from "./chess/bitboard.ts";
import { Piece, PieceColor } from "./chess/chess.ts";
import { eq } from "./lib/check.ts";

const same = (a: Zobrist, b: Zobrist) => a.isEqual(b) && JSON.stringify(a) === JSON.stringify(b);

const zobrist = new Zobrist(0, 0);
const dup = zobrist.dup();
eq("a dup is equal", same(zobrist, dup), true);
zobrist.updateTurn();
eq("the turn changes the key", same(zobrist, dup), false);
zobrist.updateTurn();
eq("and again is back", same(zobrist, dup), true);
const lightSquares = Bitboard.LIGHT_SQUARES;
zobrist.updatePieceColorBitboard(Piece.QUEEN, PieceColor.BLACK, lightSquares);
eq("a bitboard of pieces goes in, and the bitboard is untouched", [same(zobrist, dup), lightSquares.popcnt()], [false, 32]);

// Each kind of update is its own undo.
const z = new Zobrist(0, 0);
z.updatePieceColorSquare(Piece.KNIGHT, PieceColor.WHITE, 6).updateCastlingRights(15).updateEnPassantSquare(28);
const before = z.dup();
z.updatePieceColorSquare(Piece.ROOK, PieceColor.BLACK, 63).updateCastlingRights(3).updateEnPassantSquare(44).updateTurn();
eq("four updates change it", same(z, before), false);
z.updateTurn().updateEnPassantSquare(44).updateCastlingRights(3).updatePieceColorSquare(Piece.ROOK, PieceColor.BLACK, 63);
eq("the same four undo it", same(z, before), true);
eq("en passant square -1 is no update", same(z.dup().updateEnPassantSquare(-1), z), true);

// The same state reached two ways.
const a = new Zobrist(0, 0).updatePieceColorSquare(Piece.KING, PieceColor.WHITE, 4).updatePieceColorSquare(Piece.KING, PieceColor.BLACK, 60).updateCastlingRights(0);
const b = new Zobrist(0, 0).updateCastlingRights(0).updatePieceColorSquare(Piece.KING, PieceColor.BLACK, 60).updatePieceColorSquare(Piece.KING, PieceColor.WHITE, 4);
eq("order does not matter: the same pieces hash alike", same(a, b), true);
const c = a.dup().updatePieceColorSquare(Piece.KING, PieceColor.WHITE, 4).updatePieceColorSquare(Piece.KING, PieceColor.WHITE, 5);
eq("a king a square over hashes differently", [same(a, c), a.getHashKey() === c.getHashKey()], [false, false]);
eq("a piece's colour and kind are in the key", [
  same(new Zobrist(0, 0).updatePieceColorSquare(Piece.PAWN, PieceColor.WHITE, 12), new Zobrist(0, 0).updatePieceColorSquare(Piece.PAWN, PieceColor.BLACK, 12)),
  same(new Zobrist(0, 0).updatePieceColorSquare(Piece.PAWN, PieceColor.WHITE, 12), new Zobrist(0, 0).updatePieceColorSquare(Piece.KNIGHT, PieceColor.WHITE, 12)),
], [false, false]);

// The table: every value distinct, non-zero, and the same each run.
eq("the table has 2 + 1536 + 32 + 16 values, all non-zero, all distinct", [RANDOM_VALUES.length, RANDOM_VALUES.every((v) => v > 0 && v <= 0xFFFFFFFF), new Set(RANDOM_VALUES).size], [1586, true, 1586]);
eq("seeded, so the same every run", [createRandomValues(3), RANDOM_VALUES.slice(0, 3).every((v, i) => v === createRandomValues(3)[i])], [[3777279546, 2342155435, 1692513196], true]);
eq("the key reads as 16 hex digits", [new Zobrist(0x1234, 0xABCDEF00).toString(), new Zobrist(0, 0).toString().length], ["abcdef0000001234", 16]);

// expect: ok a dup is equal
// expect: ok the turn changes the key
// expect: ok and again is back
// expect: ok a bitboard of pieces goes in, and the bitboard is untouched
// expect: ok four updates change it
// expect: ok the same four undo it
// expect: ok en passant square -1 is no update
// expect: ok order does not matter: the same pieces hash alike
// expect: ok a king a square over hashes differently
// expect: ok a piece's colour and kind are in the key
// expect: ok the table has 2 + 1536 + 32 + 16 values, all non-zero, all distinct
// expect: ok seeded, so the same every run
// expect: ok the key reads as 16 hex digits
