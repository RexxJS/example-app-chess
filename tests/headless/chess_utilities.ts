// app/chess/chess.ts: the QUnit "utilities" cases of src/test.js, and the
// glyphs and names beside them.
import * as C from "./chess/chess.ts";
import { eq } from "./lib/check.ts";

eq("rank of an index", [C.getRank(0), C.getRank(7), C.getRank(56), C.getRank(63)], [0, 0, 7, 7]);
eq("file of an index", [C.getFile(0), C.getFile(7), C.getFile(56), C.getFile(63)], [0, 7, 0, 7]);
eq("inside the board", [C.isInsideBoard(0, 0), C.isInsideBoard(7, 7)], [true, true]);
eq("outside it", [C.isInsideBoard(-1, -1), C.isInsideBoard(8, 8), C.isInsideBoard(-1, 0), C.isInsideBoard(8, 0), C.isInsideBoard(0, -1), C.isInsideBoard(0, 8)],
  [false, false, false, false, false, false]);
eq("index of a rank and file", [C.getIndex(0, 0), C.getIndex(0, 7), C.getIndex(7, 0), C.getIndex(7, 7)], [0, 7, 56, 63]);
eq("a1 is dark, h1 light", [C.isLight(0, 0), C.isLight(0, 7)], [false, true]);
eq("algebraic from rank and file", [C.getAlgebraic(0, 0), C.getAlgebraic(7, 7)], ["a1", "h8"]);
eq("index from algebraic", [C.getIndexFromAlgebraic("a1"), C.getIndexFromAlgebraic("h8"), C.getIndexFromAlgebraic("e4")], [0, 63, 28]);
eq("and -1 for what is no square", [C.getIndexFromAlgebraic("i1"), C.getIndexFromAlgebraic("a9"), C.getIndexFromAlgebraic("e"), C.getIndexFromAlgebraic("e44")], [-1, -1, -1, -1]);
eq("algebraic from index", [C.getAlgebraicFromIndex(0), C.getAlgebraicFromIndex(63), C.getAlgebraicFromIndex(28)], ["a1", "h8", "e4"]);
eq("the other colour", [C.getOtherPieceColor(C.PieceColor.WHITE), C.getOtherPieceColor(C.PieceColor.BLACK)], [C.PieceColor.BLACK, C.PieceColor.WHITE]);
eq("every square round-trips", Array.from({ length: 64 }, (_, i) => C.getIndexFromAlgebraic(C.getAlgebraicFromIndex(i)) === i).every(Boolean), true);
eq("pieces, their names and letters", [C.Piece.PAWN, C.Piece.KING, C.PIECE_NAMES[C.Piece.KNIGHT], C.PIECE_ALGEBRAIC_NAMES.charAt(C.Piece.QUEEN), C.PIECE_ALGEBRAIC_NAMES.charAt(C.Piece.PAWN)],
  [0, 5, "knight", "Q", " "]);
eq("the glyphs: white king, black pawn", [C.getPieceCharacter(C.Piece.KING, C.PieceColor.WHITE), C.getPieceCharacter(C.Piece.PAWN, C.PieceColor.BLACK)], ["♔", "♟"]);

// expect: ok rank of an index
// expect: ok file of an index
// expect: ok inside the board
// expect: ok outside it
// expect: ok index of a rank and file
// expect: ok a1 is dark, h1 light
// expect: ok algebraic from rank and file
// expect: ok index from algebraic
// expect: ok and -1 for what is no square
// expect: ok algebraic from index
// expect: ok the other colour
// expect: ok every square round-trips
// expect: ok pieces, their names and letters
// expect: ok the glyphs: white king, black pawn
