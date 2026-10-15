// A position set up from the board part of a FEN (rank 8 first, "/"
// between ranks, a digit for empty squares, upper case white), the side to
// move, the castling rights ("KQkq", "-") and the en passant square ("-"
// or "e3"): for the perft positions, until parser.ts reads FEN whole.
import { Position } from "../chess/position.ts";
import { PIECE_ALGEBRAIC_NAMES, Piece, PieceColor, getIndex, getIndexFromAlgebraic } from "../chess/chess.ts";
import type { PieceColor as Color } from "../chess/chess.ts";

export function setUp(board: string, turn: "w" | "b" = "w", castling = "-", enPassant = "-"): Position {
  const p = Position.empty();
  const ranks = board.split("/");
  for (let r = 0; r < 8; ++r) {
    let file = 0;
    for (const ch of ranks[r]) {
      if (ch >= "1" && ch <= "8") { file += Number(ch); continue; }
      const color: Color = ch === ch.toUpperCase() ? PieceColor.WHITE : PieceColor.BLACK;
      const letter = ch.toUpperCase();
      const piece = letter === "P" ? Piece.PAWN : PIECE_ALGEBRAIC_NAMES.indexOf(letter);
      p.putPiece(piece as Piece, color, getIndex(7 - r, file));
      file++;
    }
  }
  p.turn = turn === "w" ? PieceColor.WHITE : PieceColor.BLACK;
  p.castlingRights = (castling.includes("K") ? 1 : 0) | (castling.includes("k") ? 2 : 0) | (castling.includes("Q") ? 4 : 0) | (castling.includes("q") ? 8 : 0);
  // The engine keeps the square the pawn moved to, not the one behind it.
  if (enPassant !== "-") {
    const behind = getIndexFromAlgebraic(enPassant);
    p.enPassantSquare = p.turn === PieceColor.WHITE ? behind - 8 : behind + 8;
  }
  p.updateHashKey();
  return p;
}
