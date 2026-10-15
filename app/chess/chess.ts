// chess.ts: constants, pieces, colours, squares and the utilities on them.
// A port of src/chess.js from Kaj Björklund's JavaScript Chess
// (https://github.com/kbjorklu/chess, MIT, copyright (c) 2013 Kaj Björklund;
// LICENSE), to sae's TypeScript dialect: the Chess namespace's members as
// a module's exports, the enums as const objects (the dialect has no
// enum), the same names otherwise.
//
// A square is an index 0-63, a1 = 0, b1 = 1, ... h8 = 63 (least significant
// file): rank = index >>> 3, file = index & 7. A rank is 0-7 (shown 1-8),
// a file 0-7 (shown a-h).

export const RANKS = 8;
export const LAST_RANK = RANKS - 1;
export const FILES = 8;
export const LAST_FILE = FILES - 1;
export const FILE_CHARACTERS = "abcdefgh";
export const RANK_CHARACTERS = "12345678";

export const Piece = { PAWN: 0, KNIGHT: 1, BISHOP: 2, ROOK: 3, QUEEN: 4, KING: 5 } as const;
export type Piece = 0 | 1 | 2 | 3 | 4 | 5;

export const PieceColor = { WHITE: 0, BLACK: 1 } as const;
export type PieceColor = 0 | 1;

export const PIECE_NAMES = ["pawn", "knight", "bishop", "rook", "queen", "king"];
export const PIECE_ALGEBRAIC_NAMES = " NBRQK";
// White then black, pawn to king: ♙♟♘♞♗♝♖♜♕♛♔♚.
export const PIECE_CHARACTERS = "♙♟♘♞♗♝♖♜♕♛♔♚";

/** 0-63 to its rank 0-7. */
export function getRank(index: number): number {
  return index >>> 3;
}

/** 0-63 to its file 0-7. */
export function getFile(index: number): number {
  return index & 7;
}

/** True when rank and file are both 0-7. */
export function isInsideBoard(rank: number, file: number): boolean {
  return !((rank | file) & ~7);
}

/** Rank and file to 0-63. */
export function getIndex(rank: number, file: number): number {
  return file + rank * FILES;
}

/** True when the square at rank, file is a light one (a1 is dark). */
export function isLight(rank: number, file: number): boolean {
  return !!((rank + file) % 2);
}

/** Rank and file to "a1".."h8". */
export function getAlgebraic(rank: number, file: number): string {
  return FILE_CHARACTERS[file] + RANK_CHARACTERS[rank];
}

/** "a1".."h8" to 0-63; -1 when it is no square. */
export function getIndexFromAlgebraic(algebraic: string): number {
  const file = FILE_CHARACTERS.indexOf(algebraic[0]);
  const rank = RANK_CHARACTERS.indexOf(algebraic[1]);
  if (file < 0 || rank < 0 || algebraic.length !== 2) return -1;
  return getIndex(rank, file);
}

/** 0-63 to "a1".."h8". */
export function getAlgebraicFromIndex(index: number): string {
  return getAlgebraic(getRank(index), getFile(index));
}

/** The Unicode chess glyph of a piece of a colour. */
export function getPieceCharacter(piece: Piece, color: PieceColor): string {
  return PIECE_CHARACTERS.charAt(piece * 2 + color);
}

/** White's other colour is black, and black's white. */
export function getOtherPieceColor(color: PieceColor): PieceColor {
  return (color ^ 1) as PieceColor;
}
