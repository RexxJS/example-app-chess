// ai.ts: the computer player: a negamax alpha-beta search, deepened one
// half-move at a time, with a transposition table on the Zobrist hash,
// move ordering (the table's move, captures by most valuable victim and
// least valuable attacker, killer moves, the history heuristic), and a
// quiescence search of the captures that do not lose material (static
// exchange evaluation) at its leaves; an evaluation of material (with the
// bishop pair), piece-square tables tapered by the game's phase (the
// king's middle and end game tables) and mobility. A port of src/ai.js
// from Kaj Björklund's JavaScript Chess (https://github.com/kbjorklu/chess,
// MIT, copyright (c) 2013 Kaj Björklund; LICENSE), to sae's TypeScript
// dialect, taken on through the old README's list (TODO.md 4.3).
//
// Changed from the old: the depth is a parameter (the old searched four
// half-moves, always); level n of the game is n half-moves. The old's
// minimax (white maximises, black minimises) is negamax here; a mate is
// worth less the further off it is, so the nearest is played; the
// quiescence search finds a mate where it is in check. Among moves of equal
// value one is chosen by a hash of the position and a seed: "a little
// randomness" that is the same each time, so the same position at the
// same level gives the same move, and a journal replays.
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

/** What a mate is worth, to the side that mates, now; one less for each half-move it is off. */
export const MATE_VALUE = PIECE_VALUES[Piece.KING];

/** A value that is a mate found, not a judgement of the position. */
export const isMateValue = (v: number): boolean => Math.abs(v) > MATE_VALUE - 1000;

/** The king in the end game (the old had it, commented out), a8 first as the others: the centre is worth most. */
export const KING_END_GAME_TABLE: readonly number[] = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];

/** The game's phase, from the pieces left (knights and bishops 1, rooks 2, queens 4): 24 at the start (and above, held to it), 0 with kings and pawns only. */
export const PHASE_MAX = 24;
const PHASE_WEIGHTS = [0, 1, 1, 2, 4, 0];
export function gamePhase(position: Position): number {
  const n = (p: Piece) => position.getPieceBitboard(p).popcnt();
  return Math.min(PHASE_MAX, n(Piece.KNIGHT) + n(Piece.BISHOP) + 2 * n(Piece.ROOK) + 4 * n(Piece.QUEEN));
}

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

/** The pieces' squares' worth to `color`; the king's from its middle and end game tables, weighed by the phase (PHASE_MAX: all middle game). */
export function getPieceSquareValue(position: Position, color: PieceColor, phase: number = PHASE_MAX): number {
  let value = 0;
  for (let piece = Piece.PAWN; piece <= Piece.KING; ++piece) {
    const pieces = position.getPieceColorBitboard(piece as Piece, color);
    while (!pieces.isEmpty()) {
      const index = pieces.extractLowestBitPosition();
      const at = color ? index : (56 ^ index);
      value += piece === Piece.KING
        ? Math.round((PIECE_SQUARE_TABLES[piece][at] * phase + KING_END_GAME_TABLE[at] * (PHASE_MAX - phase)) / PHASE_MAX)
        : PIECE_SQUARE_TABLES[piece][at];
    }
  }
  return value;
}

export function evaluateLocations(position: Position, phase: number = PHASE_MAX): number {
  return getPieceSquareValue(position, PieceColor.WHITE, phase) - getPieceSquareValue(position, PieceColor.BLACK, phase);
}

/** The squares `color`'s pawns may push to (one or two). */
export function makePawnPositionalMask(color: PieceColor, pawns: Bitboard, empty: Bitboard): Bitboard {
  const white = (color === PieceColor.WHITE);
  const positional = pawns.dup().shiftLeft(white ? 8 : -8).and(empty);
  const doublePush = pawns.dup().and(Bitboard.RANKS[white ? 1 : 6]).shiftLeft(white ? 16 : -16).and(empty).and(empty.dup().shiftLeft(white ? 8 : -8));
  return positional.or(doublePush);
}

/** The old's rough count of `color`'s moves (pseudo-legal, a square two pieces reach counted once), in centipawns; the evaluation counts by getMoveCount. */
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

// The squares a knight or king reaches from each square, and the rays a
// bishop or rook slides along (each a list of squares outward), for the
// evaluation's one pass over the board: plain arrays, no bitboards made.
const STEPS = (deltas: readonly (readonly [number, number])[]): number[][] => Array.from({ length: 64 }, (_, sq) => {
  const r = sq >> 3, f = sq & 7, out: number[] = [];
  for (const [dr, df] of deltas) if (r + dr >= 0 && r + dr < 8 && f + df >= 0 && f + df < 8) out.push((r + dr) * 8 + f + df);
  return out;
});
const RAYS = (deltas: readonly (readonly [number, number])[]): number[][][] => Array.from({ length: 64 }, (_, sq) => deltas.map(([dr, df]) => {
  const out: number[] = [];
  for (let r = (sq >> 3) + dr, f = (sq & 7) + df; r >= 0 && r < 8 && f >= 0 && f < 8; r += dr, f += df) out.push(r * 8 + f);
  return out;
}));
const KNIGHT_TARGETS = STEPS([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]);
const KING_TARGETS = STEPS([[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]);
const BISHOP_RAYS = RAYS([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
const ROOK_RAYS = RAYS([[1, 0], [-1, 0], [0, 1], [0, -1]]);

/**
 * How many moves `color`'s pieces have (pseudo-legal: each piece's squares
 * not its own side's, a pawn's pushes and captures), in centipawns, one a
 * move. The old's getMobilityValue counted a square two pieces reach once;
 * this counts each piece's.
 */
export function getMoveCount(position: Position, color: PieceColor): number {
  const pieces = position.pieces;
  const own = position.getColorBitboard(color);
  let n = 0;
  for (let sq = 0; sq < 64; ++sq) {
    const piece = pieces[sq];
    if (piece === null || piece === undefined || !own.isSet(sq)) continue;
    n += movesFrom(position, sq, piece, color);
  }
  return n;
}

function movesFrom(position: Position, sq: number, piece: Piece, color: PieceColor): number {
  const pieces = position.pieces;
  const own = position.getColorBitboard(color);
  let n = 0;
  if (piece === Piece.PAWN) {
    const up = color === PieceColor.WHITE ? 8 : -8;
    const one = sq + up;
    if (one >= 0 && one < 64 && pieces[one] == null) {
      n++;
      const home = color === PieceColor.WHITE ? 1 : 6;
      if ((sq >> 3) === home && pieces[one + up] == null) n++;
    }
    const f = sq & 7;
    for (const df of [-1, 1]) {
      const t = one + df;
      if (f + df >= 0 && f + df < 8 && t >= 0 && t < 64 && pieces[t] != null && !own.isSet(t)) n++;
    }
  } else if (piece === Piece.KNIGHT || piece === Piece.KING) {
    for (const t of (piece === Piece.KNIGHT ? KNIGHT_TARGETS : KING_TARGETS)[sq]) if (!own.isSet(t)) n++;
  } else {
    const rays = piece === Piece.BISHOP ? [BISHOP_RAYS] : piece === Piece.ROOK ? [ROOK_RAYS] : [BISHOP_RAYS, ROOK_RAYS];
    for (const table of rays) {
      for (const ray of table[sq]) {
        for (const t of ray) {
          if (pieces[t] == null) n++;
          else {
            if (!own.isSet(t)) n++;
            break;
          }
        }
      }
    }
  }
  return n;
}

/**
 * The position's worth to white, in centipawns: above 0 when white is
 * better. Material (evaluateMaterial), the squares by the game's phase
 * (evaluateLocations), and mobility (getMoveCount) for each side, the one
 * less the other: worked out in one pass over the board.
 */
export function evaluate(position: Position): number {
  const pieces = position.pieces;
  const white = position.getColorBitboard(PieceColor.WHITE);
  let material = 0, squares = 0, mobility = 0, phase = 0, whiteBishops = 0, blackBishops = 0;
  let whiteKing = -1, blackKing = -1;
  for (let sq = 0; sq < 64; ++sq) {
    const piece = pieces[sq];
    if (piece === null || piece === undefined) continue;
    const color = white.isSet(sq) ? PieceColor.WHITE : PieceColor.BLACK;
    const sign = color === PieceColor.WHITE ? 1 : -1;
    if (piece === Piece.KING) {
      if (color === PieceColor.WHITE) whiteKing = sq;
      else blackKing = sq;
    } else {
      material += sign * PIECE_VALUES[piece];
      squares += sign * PIECE_SQUARE_TABLES[piece][color ? sq : (56 ^ sq)];
      phase += PHASE_WEIGHTS[piece];
      if (piece === Piece.BISHOP) {
        if (color === PieceColor.WHITE) whiteBishops++;
        else blackBishops++;
      }
    }
    mobility += sign * movesFrom(position, sq, piece, color);
  }
  if (whiteBishops > 1) material += BISHOP_PAIR_VALUE;
  if (blackBishops > 1) material -= BISHOP_PAIR_VALUE;
  phase = Math.min(PHASE_MAX, phase);
  const king = (sq: number, color: PieceColor) => {
    if (sq < 0) return 0;
    const at = color ? sq : (56 ^ sq);
    return Math.round((PIECE_SQUARE_TABLES[Piece.KING][at] * phase + KING_END_GAME_TABLE[at] * (PHASE_MAX - phase)) / PHASE_MAX);
  };
  squares += king(whiteKing, PieceColor.WHITE) - king(blackKing, PieceColor.BLACK);
  return material + squares + mobility;
}

// ---- static exchange evaluation

/** Every piece, of both sides, that attacks `index` with the board occupied as `occupied`. */
export function attackersTo(position: Position, index: number, occupied: Bitboard): Bitboard {
  const at = Bitboard.makeIndex(index);
  const pawns = position.getPieceBitboard(Piece.PAWN);
  // A white pawn attacks the square if a black pawn there would attack it, and the other way round.
  const bb = makePawnAttackMask(PieceColor.BLACK, at).and(pawns).and(position.getColorBitboard(PieceColor.WHITE));
  bb.or(makePawnAttackMask(PieceColor.WHITE, at).and(pawns).and(position.getColorBitboard(PieceColor.BLACK)));
  bb.or(Bitboard.KNIGHT_MOVEMENTS[index].dup().and(position.getPieceBitboard(Piece.KNIGHT)));
  bb.or(Bitboard.KING_MOVEMENTS[index].dup().and(position.getPieceBitboard(Piece.KING)));
  const queens = position.getPieceBitboard(Piece.QUEEN);
  bb.or(makeBishopAttackMask(at, occupied).and(position.getPieceBitboard(Piece.BISHOP).dup().or(queens)));
  bb.or(makeRookAttackMask(at, occupied).and(position.getPieceBitboard(Piece.ROOK).dup().or(queens)));
  return bb.and(occupied);
}

/**
 * What a capture wins (above 0) or loses (below) once every piece that
 * can recapture on its square has, least valuable first, each side free to
 * stop: the swap list, gain[d] what the side making the d-th capture has
 * if the exchange ends there, worked back from the last. Sliding pieces
 * behind others (x-rays) join as the ones in front go.
 */
export function see(position: Position, move: Move): number {
  const to = move.getTo();
  const gain: number[] = [move.isCapture() ? PIECE_VALUES[move.getCapturedPiece()] : 0];
  let onSquare = PIECE_VALUES[move.getPiece()];
  if (move.isPromotion()) {
    gain[0] += PIECE_VALUES[move.getPromotedPiece()] - PIECE_VALUES[Piece.PAWN];
    onSquare = PIECE_VALUES[move.getPromotedPiece()];
  }
  const occupied = position.getOccupiedBitboard();
  occupied.clearBit(move.getFrom());
  if (move.isCapture()) occupied.clearBit(move.getCaptureSquare());
  let side = getOtherPieceColor(position.getTurnColor());
  let d = 0;
  for (;;) {
    const attackers = attackersTo(position, to, occupied).and(position.getColorBitboard(side));
    let piece = -1, from = -1;
    for (let p = Piece.PAWN; p <= Piece.KING; ++p) {
      const bb = position.getPieceBitboard(p as Piece).dup().and(attackers);
      if (!bb.isEmpty()) {
        piece = p;
        from = bb.getLowestBitPosition();
        break;
      }
    }
    if (piece < 0) break;
    d++;
    gain[d] = onSquare - gain[d - 1];
    occupied.clearBit(from);
    onSquare = PIECE_VALUES[piece];
    side = getOtherPieceColor(side);
  }
  for (; d > 0; --d) gain[d - 1] = -Math.max(-gain[d - 1], gain[d]);
  return gain[0];
}

// ---- move ordering

// The old's order: captures first, the most valuable taken by the least
// valuable; then by piece, kind and squares, so the order (and the move
// chosen among equals) is always the same.
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

/** What the search uses: the table, and the ordering beyond the old's (the table's move, killers, history); both on unless a test turns them off. */
export interface Options {
  readonly table?: boolean;
  readonly ordering?: boolean;
  /** Mixed with the position's hash to choose among equal moves. */
  readonly seed?: number;
}

/** Thrown inside a search past its deadline: the depth it was at is given up. */
class OutOfTime extends Error {}

const EXACT = 0, LOWER = 1, UPPER = 2;
interface Entry {
  depth: number;
  value: number;
  flag: number;
  move: number;     // a Move's value, 0 for none
}
const TABLE_MAX = 200000;
const INF = 1000000;

// The hash as one number of 53 bits, the table's key.
const keyOf = (p: Position): number => (p.hashKey.high & 0x1FFFFF) * 4294967296 + p.hashKey.low;

// A 32-bit mix (murmur3's finaliser): which of equal moves.
function mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * A search that can be done a piece at a time (TODO.md 4.2): sae stops one
 * entry into a page's JavaScript after 5 s, and a page should answer its
 * person long before that, so the page thinks in slices, a timer apart
 * (think.ts). Iterative deepening, depth 1 up to the depth asked, one root
 * move at a time: step() goes on until its budget is spent (checked
 * between root moves), and `best` is always the best move of the deepest
 * depth done. Done in slices or all at once (AI.search runs one through)
 * it is the same search, and gives the same move.
 *
 * At the root each move after the first is searched with the window just
 * below the best so far, so a move as good as it is found to be as good:
 * `ties`, among which the seed and the position's hash choose.
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
  readonly seed: number;
  /** The best move of the deepest depth completed; null until depth 1 is (or when there is no move). */
  best: Move | null = null;
  /** Its value to white, in centipawns (a mate: near MATE_VALUE, isMateValue). */
  bestValue = 0;
  /** The moves as good as the best at that depth, the best among them. */
  ties: Move[] = [];
  /** The deepest depth completed. */
  reached = 0;
  /** The search is over: the depth asked for done (or a mate found sooner), given up past a deadline, or stopped. */
  done = false;
  /** It ended past a deadline, short of the depth asked for. */
  cut = false;
  #moves: Move[];
  #white: boolean;
  #at = 1;           // the depth in progress
  #i = 0;            // the next root move at it
  #bestHere: Move | null = null;
  #valueHere = -INF;
  #tiesHere: Move[] = [];

  constructor(position: Position, depth: number, ai: AI = new AI(), seed?: number) {
    this.position = position;
    this.depth = Math.max(1, Math.floor(depth));
    this.ai = ai;
    this.seed = (seed ?? ai.options.seed ?? 0) >>> 0;
    ai.reset();
    this.#white = position.getTurnColor() === PieceColor.WHITE;
    this.#moves = ai.order(position, position.getMoves(), 0, 0);
    if (!this.#moves.length) this.done = true;
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
      if (!this.best) this.best = this.#moves[0] ?? null;
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
    this.position.makeMove(move);
    const lower = this.#bestHere ? this.#valueHere - 1 : -INF;
    const value = -this.ai.negamax(this.position, this.#at - 1, -INF, -lower, 1);
    this.position.unmakeMove();
    if (!this.#bestHere || value > this.#valueHere) {
      this.#bestHere = move;
      this.#valueHere = value;
      this.#tiesHere = [move];
    } else if (value === this.#valueHere) {
      this.#tiesHere.push(move);
    }
    if (this.#i < this.#moves.length) return;
    // A depth done: its best is the best now, one of the ties chosen by the hash and the seed.
    const ties = this.#tiesHere;
    const h = this.position.hashKey;
    this.best = ties[mix((h.low ^ h.high ^ this.seed) >>> 0) % ties.length];
    this.ties = [this.best, ...ties.filter((m) => m !== this.best)];
    this.bestValue = this.#white ? this.#valueHere : -this.#valueHere;
    this.reached = this.#at;
    // Done at the depth asked for, or at a mate for the side to move (none nearer can be found deeper).
    if (this.#at >= this.depth || this.#valueHere > MATE_VALUE - 1000) {
      this.done = true;
      return;
    }
    this.#at++;
    this.#i = 0;
    this.#moves = [this.best, ...this.#moves.filter((m) => m !== this.best)];
    this.#bestHere = null;
    this.#valueHere = -INF;
    this.#tiesHere = [];
  }
}

export class AI {
  readonly options: Options;
  /** Positions evaluated, all told. */
  evaluations = 0;
  /** Nodes searched (each position the search entered), all told. */
  nodes = 0;
  /** When a search in a slice must give up (Date.now()); Infinity for never. */
  deadline = Infinity;
  /** The transposition table: a position's key to what the search found of it. */
  table = new Map<number, Entry>();
  // Two quiet moves per ply that last cut the search off, and the history:
  // per from-to, how often a quiet move did, weighed by depth.
  #killers: number[][] = [];
  #history: number[] = new Array(64 * 64).fill(0);

  constructor(options: Options = {}) {
    this.options = options;
  }

  /** A fresh table, killers and history, for a new search (so a search does not depend on the ones before). */
  reset(): void {
    this.table = new Map();
    this.#killers = [];
    this.#history.fill(0);
  }

  /** The best move `depth` half-moves deep (1 or more), or null when there is none (mate, stalemate); all at once. */
  search(position: Position, depth: number = 4): Move | null {
    this.evaluations = 0;
    this.nodes = 0;
    const t = new Thinking(position, depth, this);
    t.step();
    return t.best;
  }

  /** The moves in the order the search tries them: the table's move, captures and promotions, killers, the rest by history; the old order breaks ties. */
  order(position: Position, moves: Move[], ply: number, tableMove: number): Move[] {
    if (this.options.ordering === false) return sortMoves(moves);
    const killers = this.#killers[ply] ?? [];
    const scored = moves.map((m) => {
      let s: number;
      if (m.value === tableMove) s = 4e9;
      else if (m.isCapture() || m.isPromotion()) {
        // By most valuable victim, least valuable attacker (the exchange
        // worked out only in the quiescence search, where it prunes: here
        // it would cost more than it saves).
        const victim = m.isCapture() ? PIECE_VALUES[m.getCapturedPiece()] : 0;
        s = 3e9 + (m.isPromotion() ? PIECE_VALUES[m.getPromotedPiece()] : 0) + victim * 16 - m.getPiece();
      } else if (m.value === killers[0]) s = 2e9 + 1;
      else if (m.value === killers[1]) s = 2e9;
      else s = this.#history[(m.getFrom() << 6) | m.getTo()];
      return { m, s, o: scoreMove(m) };
    });
    scored.sort((a, b) => (b.s - a.s) || (b.o - a.o));
    return scored.map((x) => x.m);
  }

  #tick(): void {
    if ((++this.nodes & 255) === 0 && Date.now() > this.deadline) throw new OutOfTime("out of time");
  }

  // The side to move's view of the position.
  #evaluate(position: Position): number {
    ++this.evaluations;
    const v = evaluate(position);
    return position.getTurnColor() === PieceColor.WHITE ? v : -v;
  }

  /** The position's value to the side to move, `depth` half-moves deep then the captures, within alpha and beta; `ply` from the root. */
  negamax(position: Position, depth: number, alpha: number, beta: number, ply: number): number {
    // always assume the draw will be claimed
    if (ply > 0 && position.isDraw()) return 0;
    if (depth < 1) return this.quiescence(position, alpha, beta, ply);
    this.#tick();
    const useTable = this.options.table !== false;
    const key = useTable ? keyOf(position) : 0;
    const entry = useTable ? this.table.get(key) : undefined;
    if (entry && entry.depth >= depth) {
      const v = fromTable(entry.value, ply);
      if (entry.flag === EXACT) return v;
      if (entry.flag === LOWER && v >= beta) return beta;
      if (entry.flag === UPPER && v <= alpha) return alpha;
    }
    const alpha0 = alpha;
    let legal = false;
    let bestMove = 0;
    for (const move of this.order(position, position.getMoves(true), ply, entry ? entry.move : 0)) {
      if (!position.makeMove(move)) continue;
      legal = true;
      const value = -this.negamax(position, depth - 1, -beta, -alpha, ply + 1);
      position.unmakeMove();
      if (value > alpha) {
        alpha = value;
        bestMove = move.value;
        if (alpha >= beta) {
          if (!move.isCapture() && !move.isPromotion()) {
            const k = this.#killers[ply] ?? (this.#killers[ply] = []);
            if (k[0] !== move.value) {
              k[1] = k[0];
              k[0] = move.value;
            }
            this.#history[(move.getFrom() << 6) | move.getTo()] += depth * depth;
          }
          if (useTable) this.#store(key, depth, beta, LOWER, bestMove, ply);
          return beta;
        }
      }
    }
    // no legal moves: stalemate, a draw; or checkmate, the side to move loses (later is better)
    if (!legal) return position.isKingInCheck() ? -(MATE_VALUE - ply) : 0;
    if (useTable) this.#store(key, depth, alpha, alpha > alpha0 ? EXACT : UPPER, bestMove, ply);
    return alpha;
  }

  /** The captures that do not lose material (all moves when in check), until the position is quiet: its value to the side to move; a mate found. */
  quiescence(position: Position, alpha: number, beta: number, ply: number): number {
    this.#tick();
    if (position.isDraw()) return 0;
    const inCheck = position.isKingInCheck();
    const moves = inCheck ? position.getMoves(true) : position.getMoves(true, true);
    // In check with no move out of it: mated. Else, in check or not, the
    // side to move may stand on the position as it is (as the old did: no
    // full search of every check at the leaves, which costs four times
    // the nodes), and search on what it may play: every move in check, else
    // the captures.
    if (inCheck && !moves.some((m) => position.makeMove(m) && (position.unmakeMove(), true))) return -(MATE_VALUE - ply);
    const standPat = this.#evaluate(position);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    for (const move of this.order(position, moves, ply, 0)) {
      if (!inCheck && this.options.ordering !== false && PIECE_VALUES[move.getCapturedPiece()] < PIECE_VALUES[move.getPiece()] && see(position, move) < 0) continue;
      if (!position.makeMove(move)) continue;
      const value = -this.quiescence(position, -beta, -alpha, ply + 1);
      position.unmakeMove();
      if (value >= beta) return beta;
      if (value > alpha) alpha = value;
    }
    return alpha;
  }

  #store(key: number, depth: number, value: number, flag: number, move: number, ply: number): void {
    if (this.table.size >= TABLE_MAX) this.table.clear();
    const old = this.table.get(key);
    if (old && old.depth > depth) return;
    this.table.set(key, { depth, value: toTable(value, ply), flag, move });
  }
}

// A mate's value in the table is from the position, not the root.
const toTable = (v: number, ply: number): number => (v > MATE_VALUE - 1000 ? v + ply : v < -(MATE_VALUE - 1000) ? v - ply : v);
const fromTable = (v: number, ply: number): number => (v > MATE_VALUE - 1000 ? v - ply : v < -(MATE_VALUE - 1000) ? v + ply : v);
