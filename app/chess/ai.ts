// ai.ts: the computer player: an alpha-beta search over the position with
// a quiescence search of captures at its leaves, and an evaluation of
// material (with the bishop pair) and piece-square tables. A port of
// src/ai.js from Kaj Björklund's JavaScript Chess
// (https://github.com/kbjorklu/chess, MIT, copyright (c) 2013 Kaj
// Björklund; LICENSE), to sae's TypeScript dialect.
//
// Changed from the old: the depth is a parameter (the old searched four
// half-moves, always: the root and three below it); level n of the game
// is n half-moves, so level 4 is the old player. The mobility term the old
// wrote and never used (getMobilityValue) is kept, unused, for 4.3.
// Nothing here is random: the same position at the same depth gives the
// same move.
import { Piece, PieceColor, getOtherPieceColor } from "./chess.ts";
import { Bitboard } from "./bitboard.ts";
import { Position, makeBishopAttackMask, makePawnAttackMask, makeRookAttackMask } from "./position.ts";
import type { Move } from "./move.ts";

/** Pawn, knight, bishop, rook, queen, king (Chess piece relative value). */
export const PIECE_VALUES = [100, 300, 300, 500, 900, 20000];

/** Per piece, a value per square from white's side, a8 first (the Simplified evaluation function); for white, read at index ^ 56. */
export const PIECE_SQUARE_TABLES: readonly (readonly number[])[] = [
  // pawn
  [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  // knight
  [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  // bishop
  [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  // rook
  [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  // queen
  [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  // king, the middle game
  [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
];

/** Two bishops are worth half a pawn more than their sum (Bishop pair). */
export const BISHOP_PAIR_VALUE = PIECE_VALUES[Piece.PAWN] / 2;

/** What a mate is worth, to the side that mates. */
export const MATE_VALUE = PIECE_VALUES[Piece.KING];

export function getMaterialValue(position: Position, color: PieceColor): number {
  let value = 0;
  for (let piece = Piece.PAWN; piece < Piece.KING; ++piece) {
    value += position.getPieceColorBitboard(piece as Piece, color).popcnt() * PIECE_VALUES[piece];
  }
  if (position.getPieceColorBitboard(Piece.BISHOP, color).popcnt() > 1) {
    value += BISHOP_PAIR_VALUE;
  }
  return value;
}

export function evaluateMaterial(position: Position): number {
  return getMaterialValue(position, PieceColor.WHITE) - getMaterialValue(position, PieceColor.BLACK);
}

export function getPieceSquareValue(position: Position, color: PieceColor): number {
  let value = 0;
  for (let piece = Piece.PAWN; piece <= Piece.KING; ++piece) {
    const pieces = position.getPieceColorBitboard(piece as Piece, color);
    while (!pieces.isEmpty()) {
      const index = pieces.extractLowestBitPosition();
      value += PIECE_SQUARE_TABLES[piece][color ? index : (56 ^ index)];
    }
  }
  return value;
}

export function evaluateLocations(position: Position): number {
  return getPieceSquareValue(position, PieceColor.WHITE) - getPieceSquareValue(position, PieceColor.BLACK);
}

/** The squares `color`'s pawns may push to (one or two). */
export function makePawnPositionalMask(color: PieceColor, pawns: Bitboard, empty: Bitboard): Bitboard {
  const white = (color === PieceColor.WHITE);
  const positional = pawns.dup().shiftLeft(white ? 8 : -8).and(empty);
  const doublePush = pawns.dup().and(Bitboard.RANKS[white ? 1 : 6]).shiftLeft(white ? 16 : -16).and(empty).and(empty.dup().shiftLeft(white ? 8 : -8));
  return positional.or(doublePush);
}

/** A rough count of `color`'s moves (pseudo-legal, some counted once where two pieces reach a square), in centipawns. */
export function getMobilityValue(position: Position, color: PieceColor): number {
  const us = position.getColorBitboard(color);
  const opponent = position.getColorBitboard(getOtherPieceColor(color));
  const occupied = position.getOccupiedBitboard();
  const empty = position.getEmptyBitboard();
  let mobility = 0;

  mobility += makePawnPositionalMask(color, position.getPieceColorBitboard(Piece.PAWN, color), empty).popcnt();
  mobility += makePawnAttackMask(color, position.getPieceColorBitboard(Piece.PAWN, color)).and(opponent).popcnt();

  const knights = position.getPieceColorBitboard(Piece.KNIGHT, color);
  while (!knights.isEmpty()) {
    mobility += Bitboard.KNIGHT_MOVEMENTS[knights.extractLowestBitPosition()].dup().and_not(us).popcnt();
  }

  mobility += Bitboard.KING_MOVEMENTS[position.getKingPosition(color)].dup().and_not(us).popcnt();

  const queens = position.getPieceColorBitboard(Piece.QUEEN, color);
  const bq = position.getPieceColorBitboard(Piece.BISHOP, color).or(queens);
  mobility += makeBishopAttackMask(bq, occupied).and_not(us).popcnt();
  const rq = position.getPieceColorBitboard(Piece.ROOK, color).or(queens);
  mobility += makeRookAttackMask(rq, occupied).and_not(us).popcnt();

  return mobility * PIECE_VALUES[Piece.PAWN] / 100;
}

/** The position's worth to white, in centipawns: above 0 when white is better. */
export function evaluate(position: Position): number {
  return evaluateMaterial(position) + evaluateLocations(position);
}

// Captures first, the most valuable taken by the least valuable; then by
// piece, kind and squares, so the order (and the move chosen among equals)
// is always the same.
function scoreMove(move: Move): number {
  let score = move.isCapture() ? ((1 + move.getCapturedPiece()) / (1 + move.getPiece())) : 0;
  score = 6 * score + move.getPiece();
  score = 16 * score + move.getKind();
  score = 64 * score + move.getTo();
  score = 64 * score + move.getFrom();
  return score;
}

export function sortMoves(moves: Move[]): Move[] {
  return moves.sort((a, b) => scoreMove(b) - scoreMove(a));
}

/** How deep the computer looks at a level of the game (1 to 4): that many half-moves, then captures. */
export function depthOf(level: number): number {
  return Math.max(1, Math.min(4, Math.floor(level) || 1));
}

/** Thrown inside a search past its deadline: the depth it was at is given up. */
class OutOfTime extends Error {}

/**
 * A search that can be done a piece at a time (TODO.md 4.2): sae stops one
 * entry into a page's JavaScript after 5 s, and a page should answer its
 * person long before that, so the page thinks in slices, a timer apart.
 * Iterative deepening, depth 1 up to the depth asked, one root move at a
 * time: step() goes on until its budget is spent (checked between root
 * moves), and `best` is always the best move of the deepest depth done.
 * Run to the end it is the same search as the old player's, so it gives
 * the same move: AI.search runs one so.
 *
 * It searches a position of its own (the caller's copy): a slice leaves it
 * as it found it. A hard deadline in a slice (hardMs) gives up the depth
 * in progress and ends the search with the depth before it, so no slice
 * runs on past it, however slow a root move's search.
 */
export class Thinking {
  readonly position: Position;
  /** The depth asked for: how many half-moves. */
  readonly depth: number;
  readonly ai: AI;
  /** The best move of the deepest depth completed; null until depth 1 is (or when there is no move). */
  best: Move | null = null;
  /** Its value to white, in centipawns. */
  bestValue = 0;
  /** The deepest depth completed. */
  reached = 0;
  /** The search is over: the depth asked for done, given up past a deadline, or stopped. */
  done = false;
  /** It ended past a deadline, short of the depth asked for. */
  cut = false;
  #moves: Move[];
  #white: boolean;
  #at = 1;           // the depth in progress
  #i = 0;            // the next root move at it
  #alpha = -Infinity;
  #beta = Infinity;
  #bestHere: Move | null = null;
  #legalHere = false;

  constructor(position: Position, depth: number, ai: AI = new AI()) {
    this.position = position;
    this.depth = Math.max(1, Math.floor(depth));
    this.ai = ai;
    this.#white = position.getTurnColor() === PieceColor.WHITE;
    this.#moves = sortMoves(position.getMoves(true));
    if (!position.getMoves().length) this.done = true;
  }

  /** Root moves searched so far at the depth in progress, and how many there are. */
  progress(): { depth: number; move: number; of: number } {
    return { depth: this.done ? this.reached : this.#at, move: this.#i, of: this.#moves.length };
  }

  /** Searches on for about `budgetMs` (at least one root move), never past `hardMs`; true when the search is over. */
  step(budgetMs: number = Infinity, hardMs: number = Infinity): boolean {
    if (this.done) return true;
    const t0 = Date.now();
    this.ai.deadline = hardMs === Infinity ? Infinity : t0 + hardMs;
    const base = this.position.getMadeMoveCount();
    try {
      do {
        this.#rootMove();
      } while (!this.done && Date.now() - t0 < budgetMs);
    } catch (e) {
      if (!(e instanceof OutOfTime)) throw e;
      while (this.position.getMadeMoveCount() > base) this.position.unmakeMove();
      this.cut = true;
      this.done = true;
      if (!this.best) this.best = this.position.getMoves()[0] ?? null;
    } finally {
      this.ai.deadline = Infinity;
    }
    return this.done;
  }

  /** Ends the search now, with the best move so far. */
  stop(): void {
    this.done = true;
  }

  #rootMove(): void {
    const move = this.#moves[this.#i++];
    if (this.position.makeMove(move)) {
      this.#legalHere = true;
      const value = this.ai.alphaBeta(this.position, this.#at - 1, this.#alpha, this.#beta);
      this.position.unmakeMove();
      if (this.#white) {
        if (value > this.#alpha) {
          this.#alpha = value;
          this.#bestHere = move;
        }
      } else if (value < this.#beta) {
        this.#beta = value;
        this.#bestHere = move;
      }
      // Only one of alpha and beta moves at the root: the other stays infinite.
    }
    if (this.#i < this.#moves.length) return;
    // A depth done: its best is the best now.
    this.best = this.#bestHere;
    this.bestValue = this.#white ? this.#alpha : this.#beta;
    this.reached = this.#at;
    if (this.#at >= this.depth || !this.#legalHere) {
      this.done = true;
      return;
    }
    this.#at++;
    this.#i = 0;
    this.#alpha = -Infinity;
    this.#beta = Infinity;
    this.#bestHere = null;
  }
}

export class AI {
  /** Positions evaluated, all told. */
  evaluations = 0;
  /** When a search in a slice must give up (Date.now()); Infinity for never. */
  deadline = Infinity;

  /** The best move `depth` half-moves deep (1 or more), or null when there is none (mate, stalemate); all at once. */
  search(position: Position, depth: number = 4): Move | null {
    this.evaluations = 0;
    const t = new Thinking(position, depth, this);
    t.step();
    return t.best;
  }

  quiescenceSearch(position: Position, alpha: number, beta: number): number {
    if (position.isDraw()) {
      // always assume the draw will be claimed
      return 0;
    }
    const standPatValue = evaluate(position);
    if ((++this.evaluations & 255) === 0 && Date.now() > this.deadline) throw new OutOfTime("out of time");
    const white = (position.getTurnColor() === PieceColor.WHITE);
    if (white) {
      if (standPatValue >= beta) return beta;
      alpha = (standPatValue > alpha) ? standPatValue : alpha;
    } else {
      if (standPatValue <= alpha) return alpha;
      beta = (standPatValue < beta) ? standPatValue : beta;
    }
    for (const move of sortMoves(position.getMoves(true, !position.isKingInCheck()))) {
      if (position.makeMove(move)) {
        const value = this.quiescenceSearch(position, alpha, beta);
        position.unmakeMove();
        if (white) {
          if (value >= beta) return beta;
          alpha = (value > alpha) ? value : alpha; // max player (white)
        } else {
          if (value <= alpha) return alpha;
          beta = (value < beta) ? value : beta; // min player (black)
        }
      }
    }
    return white ? alpha : beta;
  }

  alphaBeta(position: Position, depth: number, alpha: number, beta: number): number {
    if (depth < 1) return this.quiescenceSearch(position, alpha, beta);
    const white = (position.getTurnColor() === PieceColor.WHITE);
    let legal = false;
    for (const move of sortMoves(position.getMoves(true, false))) {
      if (position.makeMove(move)) {
        legal = true;
        const value = this.alphaBeta(position, depth - 1, alpha, beta);
        position.unmakeMove();
        if (white) alpha = (value > alpha) ? value : alpha; // max player (white)
        else beta = (value < beta) ? value : beta; // min player (black)
        if (beta <= alpha) break;
      }
    }
    if (!legal) {
      // no legal moves: stalemate, a draw; or checkmate, the player in turn loses
      if (!position.isKingInCheck()) return 0;
      return white ? -MATE_VALUE : MATE_VALUE;
    }
    // always assume the draw will be claimed
    if (position.isDraw()) return 0;
    return white ? alpha : beta;
  }
}
