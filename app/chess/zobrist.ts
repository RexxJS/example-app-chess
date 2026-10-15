// zobrist.ts: the position's 64-bit Zobrist hash, as two 32-bit halves,
// each update its own undo (xor the same value again). A port of
// src/zobrist.js from Kaj Björklund's JavaScript Chess
// (https://github.com/kbjorklu/chess, MIT, copyright (c) 2013 Kaj
// Björklund; LICENSE), to sae's TypeScript dialect, with one change: the
// random table comes from a seeded generator (xorshift32), not
// Math.random, so a position's hash is the same from one run to the next
// (a transposition table saved, a test's expected key).
import { getFile } from "./chess.ts";
import type { Piece, PieceColor } from "./chess.ts";
import type { Bitboard } from "./bitboard.ts";

// How many random values each part of the key takes: two 32-bit halves each.
const Count = {
  TURN: 1 * 2,
  PIECE_COLOR_SQUARE: 6 * 2 * 64 * 2,
  CASTLING_RIGHTS: 16 * 2,
  EN_PASSANT_FILE: 8 * 2,
} as const;

// Where each part starts in the table.
const Position = {
  TURN: 0,
  PIECE_COLOR_SQUARE: Count.TURN,
  CASTLING_RIGHTS: Count.TURN + Count.PIECE_COLOR_SQUARE,
  EN_PASSANT_FILE: Count.TURN + Count.PIECE_COLOR_SQUARE + Count.CASTLING_RIGHTS,
} as const;

/** `count` 32-bit values from a seed, the same every time (xorshift32). */
export function createRandomValues(count: number, seed = 0x2545F491): number[] {
  const a: number[] = [];
  let x = seed >>> 0 || 1;
  for (let i = 0; i < count; ++i) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    a.push(x);
  }
  return a;
}

export const RANDOM_VALUES = createRandomValues(Position.EN_PASSANT_FILE + Count.EN_PASSANT_FILE);

export class Zobrist {
  low: number;
  high: number;

  constructor(low: number, high: number) {
    this.low = low >>> 0;
    this.high = high >>> 0;
  }

  dup(): Zobrist {
    return new Zobrist(this.low, this.high);
  }

  /** A 32-bit key for a table. */
  getHashKey(): number {
    return (this.low ^ this.high) >>> 0;
  }

  isEqual(zobrist: Zobrist): boolean {
    return this.low === zobrist.low && this.high === zobrist.high;
  }

  /** The key as 16 hex digits, high half first. */
  toString(): string {
    return this.high.toString(16).padStart(8, "0") + this.low.toString(16).padStart(8, "0");
  }

  /** Xors RANDOM_VALUES[position] and [position + 1] in. */
  update(position: number): Zobrist {
    this.low = (this.low ^ RANDOM_VALUES[position]) >>> 0;
    this.high = (this.high ^ RANDOM_VALUES[position + 1]) >>> 0;
    return this;
  }

  updateTurn(): Zobrist {
    return this.update(Position.TURN);
  }

  updatePieceColorSquare(piece: Piece, color: PieceColor, index: number): Zobrist {
    return this.update(Position.PIECE_COLOR_SQUARE + piece + color * 6 + index * 6 * 2);
  }

  updatePieceColorBitboard(piece: Piece, color: PieceColor, bitboard: Bitboard): Zobrist {
    const bb = bitboard.dup();
    while (!bb.isEmpty()) {
      this.updatePieceColorSquare(piece, color, bb.extractLowestBitPosition());
    }
    return this;
  }

  updateCastlingRights(castlingRights: number): Zobrist {
    return this.update(Position.CASTLING_RIGHTS + castlingRights);
  }

  updateEnPassantFile(enPassantFile: number): Zobrist {
    return this.update(Position.EN_PASSANT_FILE + enPassantFile);
  }

  /** A square of -1 (no en passant) changes nothing. */
  updateEnPassantSquare(enPassantSquare: number): Zobrist {
    if (enPassantSquare >= 0) {
      return this.updateEnPassantFile(getFile(enPassantSquare));
    }
    return this;
  }
}
