// move.ts: a move, packed in one integer (to, from, kind, the moving piece,
// the captured piece), and its long algebraic text. A port of src/move.js
// from Kaj Björklund's JavaScript Chess (https://github.com/kbjorklu/chess,
// MIT, copyright (c) 2013 Kaj Björklund; LICENSE), to sae's TypeScript
// dialect: the same bit layout (Encoding Moves, chessprogramming.org),
// Kind as a const object.
import { FILES, PIECE_ALGEBRAIC_NAMES, Piece, getAlgebraicFromIndex } from "./chess.ts";

// Bit 2 of a kind is a capture, bit 3 a promotion, the low two bits of a
// promotion which piece (knight 0 .. queen 3).
export const Kind = {
  POSITIONAL: 0,
  DOUBLE_PAWN_PUSH: 1,
  KING_CASTLE: 2,
  QUEEN_CASTLE: 3,
  CAPTURE: 4,
  EN_PASSANT_CAPTURE: 5,
  KNIGHT_PROMOTION: 8,
  BISHOP_PROMOTION: 9,
  ROOK_PROMOTION: 10,
  QUEEN_PROMOTION: 11,
  KNIGHT_PROMOTION_CAPTURE: 12,
  BISHOP_PROMOTION_CAPTURE: 13,
  ROOK_PROMOTION_CAPTURE: 14,
  QUEEN_PROMOTION_CAPTURE: 15,
} as const;
export type Kind = 0 | 1 | 2 | 3 | 4 | 5 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export class Move {
  /** to (6 bits) | from << 6 | kind << 12 | piece << 16 | captured << 19 (a null capture is stored as pawn). */
  value: number;

  constructor(from: number, to: number, kind: Kind, piece: Piece, capturedPiece: Piece | null) {
    this.value = (to & 0x3F) | ((from & 0x3F) << 6) | ((kind & 0xF) << 12) | ((piece & 0x7) << 16) | ((((capturedPiece as number) | 0) & 0x7) << 19);
  }

  getTo(): number {
    return this.value & 0x3F;
  }

  getFrom(): number {
    return (this.value >>> 6) & 0x3F;
  }

  getKind(): Kind {
    return ((this.value >>> 12) & 0xF) as Kind;
  }

  getPiece(): Piece {
    return ((this.value >>> 16) & 0x7) as Piece;
  }

  isCapture(): boolean {
    return !!(this.getKind() & 4);
  }

  /** The piece taken; pawn when there was none (ask isCapture first). */
  getCapturedPiece(): Piece {
    return ((this.value >>> 19) & 0x7) as Piece;
  }

  isPromotion(): boolean {
    return !!(this.getKind() & 8);
  }

  isCastle(): boolean {
    return this.getKind() === Kind.KING_CASTLE || this.getKind() === Kind.QUEEN_CASTLE;
  }

  /** The piece a pawn becomes; pawn when the move is no promotion. */
  getPromotedPiece(): Piece {
    if (this.isPromotion()) {
      return (Piece.KNIGHT + (this.getKind() & 3)) as Piece;
    }
    return Piece.PAWN;
  }

  /** The square the captured piece stood on: `to`, but a rank back for en passant. */
  getCaptureSquare(): number {
    if (this.getKind() !== Kind.EN_PASSANT_CAPTURE) {
      return this.getTo();
    }
    return this.getTo() + ((this.getFrom() < this.getTo()) ? -FILES : FILES);
  }

  isEqual(other: Move): boolean {
    return this.value === other.value;
  }

  /**
   * Long algebraic notation, with no position to hand: "Ng1-f3", "e4xd5",
   * "e5xd6e.p.", "e7-e8Q", "0-0", "0-0-0". No check or mate mark (the
   * parser, which has the position, gives SAN with them).
   */
  getString(): string {
    if (!this.isCastle()) {
      return PIECE_ALGEBRAIC_NAMES.charAt(this.getPiece()).trim() +
        getAlgebraicFromIndex(this.getFrom()) +
        (this.isCapture() ? "x" : "-") +
        getAlgebraicFromIndex(this.getTo()) +
        ((this.getKind() === Kind.EN_PASSANT_CAPTURE) ? "e.p." : "") +
        (this.isPromotion() ? PIECE_ALGEBRAIC_NAMES.charAt(this.getPromotedPiece()) : "");
    }
    return "0-0" + ((this.getKind() === Kind.QUEEN_CASTLE) ? "-0" : "");
  }

  /** Coordinate notation: "e2e4", "e7e8q" (the promotion piece in lower case). */
  getCoordinate(): string {
    return getAlgebraicFromIndex(this.getFrom()) + getAlgebraicFromIndex(this.getTo()) +
      (this.isPromotion() ? PIECE_ALGEBRAIC_NAMES.charAt(this.getPromotedPiece()).toLowerCase() : "");
  }
}
