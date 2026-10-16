// position.ts: the game state (pieces, turn, castling rights, en passant,
// the clocks, the hash and the history), move generation (pseudo-legal
// and legal, captures only), make and unmake, check, the status (mate,
// stalemate, the draws). A port of src/position.js from Kaj Björklund's
// JavaScript Chess (https://github.com/kbjorklu/chess, MIT, copyright (c)
// 2013 Kaj Björklund; LICENSE), to sae's TypeScript dialect.
//
// Changed from the old: unmakeMove restores halfmoveClock (the old wrote
// halfMoveClock, a different name, so the fifty-move count never went
// back); threefold repetition counts the position now as one of the three
// (the old needed three earlier ones, so fired on the fourth); a
// fullmoveNumber for FEN; Status.CHECK; and empty() with putPiece() to
// set a position up (the parser's FEN uses them). Chess960 (TODO.md 6.5):
// the castling rooks' squares are the position's own (castleRooks), and
// in a Chess960 position a castling move is the king's move on to its
// own rook (from the king's square to the rook's), ending, as in chess,
// with the king on the g- or c-file and the rook beside it on f or d;
// a position with the usual king and rooks keeps the usual moves.
import { FILES, LAST_FILE, LAST_RANK, Piece, PieceColor, getOtherPieceColor } from "./chess.ts";
import { Bitboard } from "./bitboard.ts";
import { Zobrist } from "./zobrist.ts";
import { Move, Kind } from "./move.ts";

/** Indices into bitboards after the six pieces: all white, all black. */
export const ANY_WHITE = Piece.KING + 1;
export const ANY_BLACK = ANY_WHITE + 1;

/** The home square of each castling rook: white king side, black king side, white queen side, black queen side. */
export const ROOK_INDICES = [7, 63, 0, 56];

/** Masks that stop a sliding piece wrapping: for a file direction of -1, 0, 1. */
export const SLIDING_MASKS = [Bitboard.makeFile(LAST_FILE).not(), Bitboard.ONE, Bitboard.makeFile(0).not()];

export const Status = {
  NORMAL: 0,
  CHECKMATE: 1,
  STALEMATE_DRAW: 2,
  FIFTY_MOVE_RULE_DRAW: 3,
  THREEFOLD_REPETITION_RULE_DRAW: 4,
  INSUFFICIENT_MATERIAL_DRAW: 5,
  CHECK: 6,
} as const;
export type Status = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** The squares `color`'s pawns attack (not en passant). */
export function makePawnAttackMask(color: PieceColor, pawns: Bitboard): Bitboard {
  const white = (color === PieceColor.WHITE);
  const attacks1 = pawns.dup().and_not(Bitboard.FILES[0]).shiftLeft(white ? 7 : -9);
  const attacks2 = pawns.dup().and_not(Bitboard.FILES[LAST_FILE]).shiftLeft(white ? 9 : -7);
  return attacks1.or(attacks2);
}

/** The squares reached sliding from fromBB in one direction, up to and including the first occupied one. Changes fromBB. */
export function makeSlidingAttackMask(fromBB: Bitboard, occupied: Bitboard, rankDirection: number, fileDirection: number): Bitboard {
  const bb = Bitboard.makeZero();
  const direction = rankDirection * FILES + fileDirection;
  const mask = SLIDING_MASKS[1 + fileDirection];
  for (fromBB.shiftLeft(direction); !fromBB.and(mask).isEmpty(); fromBB.and_not(occupied).shiftLeft(direction)) {
    bb.or(fromBB);
  }
  return bb;
}

export function makeBishopAttackMask(fromBB: Bitboard, occupied: Bitboard): Bitboard {
  return makeSlidingAttackMask(fromBB.dup(), occupied, 1, 1).or(
    makeSlidingAttackMask(fromBB.dup(), occupied, 1, -1)).or(
    makeSlidingAttackMask(fromBB.dup(), occupied, -1, 1)).or(
    makeSlidingAttackMask(fromBB.dup(), occupied, -1, -1));
}

export function makeRookAttackMask(fromBB: Bitboard, occupied: Bitboard): Bitboard {
  return makeSlidingAttackMask(fromBB.dup(), occupied, 0, 1).or(
    makeSlidingAttackMask(fromBB.dup(), occupied, 0, -1)).or(
    makeSlidingAttackMask(fromBB.dup(), occupied, 1, 0)).or(
    makeSlidingAttackMask(fromBB.dup(), occupied, -1, 0));
}

/** 0-3 into the castling rights: white king side, black king side, white queen side, black queen side. */
export function getCastlingIndex(color: PieceColor, kingSide: boolean): number {
  return color + (kingSide ? 0 : 2);
}

export function getCastlingRookSquare(color: PieceColor, kingSide: boolean): number {
  return ROOK_INDICES[getCastlingIndex(color, kingSide)];
}

export class Position {
  hashKey: Zobrist;
  /** One board per piece kind, then all white, all black. */
  bitboards: Bitboard[];
  /** The piece on each square, or null. */
  pieces: (Piece | null)[];
  turn: PieceColor;
  /** Bit 0: white king side, 1: black king side, 2: white queen side, 3: black queen side. */
  castlingRights: number;
  /** Where a pawn just double-pushed to, or -1. */
  enPassantSquare: number;
  /** Half-moves since the last capture or pawn move (the fifty-move rule at 100). */
  halfmoveClock: number;
  /** 1 at the start, up after each black move. */
  fullmoveNumber: number;
  madeMoves: Move[];
  /** Per move made: the en passant square, castling rights and halfmove clock before it. */
  irreversibleHistory: number[];
  /** The hash before each move made. */
  hashHistory: Zobrist[];
  /** The square of each castling rook, by castling index (white king side, black king side, white queen side, black queen side). */
  castleRooks: number[] = [...ROOK_INDICES];
  /** A Chess960 position: castling moves are the king on to its rook (generateMoves), and the castling rooks are castleRooks. */
  chess960 = false;

  /** The start position. */
  constructor() {
    this.hashKey = new Zobrist(0, 0);
    this.bitboards = [
      Bitboard.RANKS[1].dup().or(Bitboard.RANKS[6]), // pawns
      Bitboard.makeIndex(1).or(Bitboard.makeIndex(6)).or(Bitboard.makeIndex(57)).or(Bitboard.makeIndex(62)), // knights
      Bitboard.makeIndex(2).or(Bitboard.makeIndex(5)).or(Bitboard.makeIndex(58)).or(Bitboard.makeIndex(61)), // bishops
      Bitboard.makeIndex(0).or(Bitboard.makeIndex(7)).or(Bitboard.makeIndex(56)).or(Bitboard.makeIndex(63)), // rooks
      Bitboard.makeIndex(3).or(Bitboard.makeIndex(59)), // queens
      Bitboard.makeIndex(4).or(Bitboard.makeIndex(60)), // kings
      Bitboard.RANKS[0].dup().or(Bitboard.RANKS[1]), // white pieces
      Bitboard.RANKS[6].dup().or(Bitboard.RANKS[7]), // black pieces
    ];
    this.pieces = [];
    this.turn = PieceColor.WHITE;
    this.castlingRights = 15;
    this.enPassantSquare = -1;
    this.halfmoveClock = 0;
    this.fullmoveNumber = 1;
    this.madeMoves = [];
    this.irreversibleHistory = [];
    this.hashHistory = [];
    this.fillPiecesFromBitboards();
    this.updateHashKey();
  }

  /** No pieces, white to move, no castling rights: putPiece() fills it. */
  static empty(): Position {
    const p = new Position();
    for (let i = 0; i < p.bitboards.length; ++i) p.bitboards[i] = Bitboard.makeZero();
    p.castlingRights = 0;
    p.fillPiecesFromBitboards();
    p.updateHashKey();
    return p;
  }

  /** Puts a piece on a square (any piece there first goes), for setting a position up; the hash follows. */
  putPiece(piece: Piece, color: PieceColor, index: number): Position {
    this.removePiece(index);
    this.bitboards[piece].setBit(index);
    this.bitboards[ANY_WHITE + color].setBit(index);
    this.pieces[index] = piece;
    this.updateHashKey();
    return this;
  }

  removePiece(index: number): Position {
    for (let i = 0; i < this.bitboards.length; ++i) this.bitboards[i].clearBit(index);
    this.pieces[index] = null;
    this.updateHashKey();
    return this;
  }

  /** The colour of the piece on a square, or null. */
  getColorAtOrNull(index: number): PieceColor | null {
    if (this.bitboards[ANY_WHITE].isSet(index)) return PieceColor.WHITE;
    if (this.bitboards[ANY_BLACK].isSet(index)) return PieceColor.BLACK;
    return null;
  }

  /** The leaf count of the game tree `depth` half-moves down. */
  perft(depth: number): number {
    if (!depth) return 1;
    let nodes = 0;
    for (const move of this.getMoves(true)) {
      if (this.makeMove(move)) {
        nodes += this.perft(depth - 1);
        this.unmakeMove();
      }
    }
    return nodes;
  }

  /** The moves in this position: legal, or pseudo-legal too (ones that may leave the king in check); captures only when asked. */
  getMoves(pseudoLegal?: boolean, onlyCaptures?: boolean): Move[] {
    const moves = this.generateMoves(!!onlyCaptures);
    return pseudoLegal ? moves : moves.filter((m) => this.isMoveLegal(m));
  }

  getColorBitboard(color: PieceColor): Bitboard {
    return this.bitboards[ANY_WHITE + color];
  }

  getPieceBitboard(piece: Piece): Bitboard {
    return this.bitboards[piece];
  }

  /** A new board: the squares with that piece of that colour. */
  getPieceColorBitboard(piece: Piece, color: PieceColor): Bitboard {
    return this.bitboards[piece].dup().and(this.getColorBitboard(color));
  }

  getKingPosition(color: PieceColor): number {
    return this.getPieceColorBitboard(Piece.KING, color).getLowestBitPosition();
  }

  getOccupiedBitboard(): Bitboard {
    return this.bitboards[ANY_WHITE].dup().or(this.bitboards[ANY_BLACK]);
  }

  getEmptyBitboard(): Bitboard {
    return this.getOccupiedBitboard().not();
  }

  getTurnColor(): PieceColor {
    return this.turn;
  }

  /** The piece on a square from the bitboards (slow; the table is getPieceAtOrNull). */
  findPieceAtOrNull(index: number): Piece | null {
    for (let piece = Piece.PAWN; piece <= Piece.KING; ++piece) {
      if (this.getPieceBitboard(piece as Piece).isSet(index)) {
        return piece as Piece;
      }
    }
    return null;
  }

  getPieceAtOrNull(index: number): Piece | null {
    return this.pieces[index];
  }

  fillPiecesFromBitboards(): void {
    this.pieces.length = 0;
    for (let index = 0; index < 64; ++index) {
      this.pieces.push(this.findPieceAtOrNull(index));
    }
  }

  /** The hash from scratch: turn, pieces, castling rights, en passant (not the clocks). */
  updateHashKey(): void {
    this.hashKey = new Zobrist(0, 0);
    if (this.getTurnColor()) {
      this.hashKey.updateTurn();
    }
    for (let color = PieceColor.WHITE; color <= PieceColor.BLACK; ++color) {
      for (let piece = Piece.PAWN; piece <= Piece.KING; ++piece) {
        this.hashKey.updatePieceColorBitboard(piece as Piece, color as PieceColor, this.getPieceColorBitboard(piece as Piece, color as PieceColor));
      }
    }
    this.hashKey.updateCastlingRights(this.castlingRights);
    this.hashKey.updateEnPassantSquare(this.enPassantSquare);
  }

  isKingInCheck(): boolean {
    return this.isAttacked(getOtherPieceColor(this.getTurnColor()), this.getKingPosition(this.getTurnColor()));
  }

  /** True when a piece of `color` attacks the square. */
  isAttacked(color: PieceColor, index: number): boolean {
    const pawns = this.getPieceColorBitboard(Piece.PAWN, color);
    if (makePawnAttackMask(color, pawns).isSet(index)) {
      return true;
    }
    const knights = this.getPieceColorBitboard(Piece.KNIGHT, color);
    if (!Bitboard.KNIGHT_MOVEMENTS[index].dup().and(knights).isEmpty()) {
      return true;
    }
    const king = this.getPieceColorBitboard(Piece.KING, color);
    if (!Bitboard.KING_MOVEMENTS[index].dup().and(king).isEmpty()) {
      return true;
    }
    const occupied = this.getOccupiedBitboard();
    const queens = this.getPieceColorBitboard(Piece.QUEEN, color);
    const bq = this.getPieceColorBitboard(Piece.BISHOP, color).dup().or(queens);
    if (makeBishopAttackMask(bq, occupied).isSet(index)) {
      return true;
    }
    const rq = this.getPieceColorBitboard(Piece.ROOK, color).dup().or(queens);
    if (makeRookAttackMask(rq, occupied).isSet(index)) {
      return true;
    }
    return false;
  }

  hasCastlingRight(color: PieceColor, kingSide: boolean): boolean {
    return 0 !== (this.castlingRights & (1 << getCastlingIndex(color, kingSide)));
  }

  clearCastlingRight(color: PieceColor, kingSide: boolean): void {
    this.hashKey.updateCastlingRights(this.castlingRights);
    this.castlingRights &= ~(1 << getCastlingIndex(color, kingSide));
    this.hashKey.updateCastlingRights(this.castlingRights);
  }

  /** The square a castling rook stands on (its home, for the castling right). */
  rookSquare(color: PieceColor, kingSide: boolean): number {
    return this.castleRooks[getCastlingIndex(color, kingSide)];
  }

  /** The right is there and the squares between are empty; with onlyLegal, the king's path is not attacked either. */
  canCastle(color: PieceColor, kingSide: boolean, onlyLegal: boolean): boolean {
    if (!this.hasCastlingRight(color, kingSide)) {
      return false;
    }
    if (this.chess960) return this.canCastle960(color, kingSide, onlyLegal);
    const direction = kingSide ? 1 : -1;
    const kingPosition = (color === PieceColor.WHITE) ? 4 : 60;
    const occupied = this.getOccupiedBitboard();
    if (occupied.isSet(kingPosition + direction) || occupied.isSet(kingPosition + 2 * direction)) {
      return false;
    }
    if (!kingSide && occupied.isSet(kingPosition + 3 * direction)) {
      return false;
    }
    if (onlyLegal && !this.isCastlingLegal(color, kingSide)) {
      return false;
    }
    return true;
  }

  /**
   * Chess960: the king goes to the g- (king side) or c-file, the rook to f
   * or d; every square either passes over or lands on is empty but for
   * the two of them, and (onlyLegal) no square of the king's way, its own
   * and where it ends included, is attacked.
   */
  canCastle960(color: PieceColor, kingSide: boolean, onlyLegal: boolean): boolean {
    const base = color === PieceColor.WHITE ? 0 : 56;
    const king = this.getKingPosition(color), rook = this.rookSquare(color, kingSide);
    if (this.getPieceAtOrNull(rook) !== Piece.ROOK || this.getColorAtOrNull(rook) !== color || king < base || king > base + 7) return false;
    const kingTo = base + (kingSide ? 6 : 2), rookTo = base + (kingSide ? 5 : 3);
    const occupied = this.getOccupiedBitboard();
    const lo = Math.min(king, kingTo, rook, rookTo), hi = Math.max(king, kingTo, rook, rookTo);
    for (let sq = lo; sq <= hi; ++sq) {
      if (sq === king || sq === rook) continue;
      if (occupied.isSet(sq)) return false;
    }
    if (onlyLegal) {
      const other = getOtherPieceColor(color);
      const step = kingTo >= king ? 1 : -1;
      for (let sq = king; ; sq += step) {
        if (this.isAttacked(other, sq)) return false;
        if (sq === kingTo) break;
      }
    }
    return true;
  }

  isCastlingLegal(color: PieceColor, kingSide: boolean): boolean {
    const otherColor = getOtherPieceColor(color);
    const direction = kingSide ? 1 : -1;
    const kingPosition = (color === PieceColor.WHITE) ? 4 : 60;
    return !this.isAttacked(otherColor, kingPosition) && !this.isAttacked(otherColor, kingPosition + direction) && !this.isAttacked(otherColor, kingPosition + 2 * direction);
  }

  canEnPassant(): boolean {
    return this.getEnPassantSquare() >= 0;
  }

  getEnPassantSquare(): number {
    return this.enPassantSquare;
  }

  isFiftyMoveRuleDraw(): boolean {
    return this.halfmoveClock >= 100;
  }

  /** This position has come up twice before (the same pieces, turn, rights and en passant). */
  isThreefoldRepetitionRuleDraw(): boolean {
    const currentHashKey = this.hashKey;
    let earlier = 0;
    for (const h of this.hashHistory) if (h.isEqual(currentHashKey)) ++earlier;
    return earlier + 1 >= 3;
  }

  /** Kings alone, or with one minor piece, or with bishops all on one colour. */
  isInsufficientMaterialDraw(): boolean {
    if (!this.getPieceBitboard(Piece.PAWN).isEmpty()) {
      return false;
    }
    if (!this.getPieceBitboard(Piece.ROOK).isEmpty()) {
      return false;
    }
    if (!this.getPieceBitboard(Piece.QUEEN).isEmpty()) {
      return false;
    }
    // only kings, knights and bishops on the board
    const whiteCount = this.getColorBitboard(PieceColor.WHITE).popcnt();
    const blackCount = this.getColorBitboard(PieceColor.BLACK).popcnt();
    if (whiteCount + blackCount < 4) {
      // king vs king, king&bishop vs king, king&knight vs king
      return true;
    }
    if (!this.getPieceBitboard(Piece.KNIGHT).isEmpty()) {
      return false;
    }
    // only kings and bishops on the board
    const bishops = this.getPieceBitboard(Piece.BISHOP);
    if (bishops.dup().and(Bitboard.LIGHT_SQUARES).isEqual(bishops) || bishops.dup().and(Bitboard.DARK_SQUARES).isEqual(bishops)) {
      return true;
    }
    return false;
  }

  isDraw(): boolean {
    return this.isFiftyMoveRuleDraw() || this.isThreefoldRepetitionRuleDraw() || this.isInsufficientMaterialDraw();
  }

  /** Mate or stalemate when there is no move; else a draw by rule; else check; else normal. */
  getStatus(): Status {
    if (!this.getMoves().length) {
      return this.isKingInCheck() ? Status.CHECKMATE : Status.STALEMATE_DRAW;
    }
    if (this.isFiftyMoveRuleDraw()) {
      return Status.FIFTY_MOVE_RULE_DRAW;
    }
    if (this.isThreefoldRepetitionRuleDraw()) {
      return Status.THREEFOLD_REPETITION_RULE_DRAW;
    }
    if (this.isInsufficientMaterialDraw()) {
      return Status.INSUFFICIENT_MATERIAL_DRAW;
    }
    if (this.isKingInCheck()) {
      return Status.CHECK;
    }
    return Status.NORMAL;
  }

  /** The pseudo-legal moves: every move of the side to play but for leaving its king in check (castling is checked fully). */
  generateMoves(onlyCaptures: boolean): Move[] {
    const moves: Move[] = [];
    const turnColor = this.getTurnColor();
    const opponentBB = this.getColorBitboard(getOtherPieceColor(turnColor));
    const occupied = this.getOccupiedBitboard();

    // Pawn moves: double pushes, positional moves, captures, promotions, en passant
    const addPawnMoves = (toMask: Bitboard, movement: number, kind: Kind) => {
      while (!toMask.isEmpty()) {
        const index = toMask.extractLowestBitPosition();
        moves.push(new Move(index - movement, index, kind, Piece.PAWN, this.getPieceAtOrNull(index)));
      }
    };
    const addPawnPromotions = (toMask: Bitboard, movement: number, capture: boolean) => {
      addPawnMoves(toMask.dup(), movement, capture ? Kind.QUEEN_PROMOTION_CAPTURE : Kind.QUEEN_PROMOTION);
      addPawnMoves(toMask.dup(), movement, capture ? Kind.ROOK_PROMOTION_CAPTURE : Kind.ROOK_PROMOTION);
      addPawnMoves(toMask.dup(), movement, capture ? Kind.BISHOP_PROMOTION_CAPTURE : Kind.BISHOP_PROMOTION);
      addPawnMoves(toMask.dup(), movement, capture ? Kind.KNIGHT_PROMOTION_CAPTURE : Kind.KNIGHT_PROMOTION);
    };

    const fileDirection = 1 - 2 * turnColor;
    const rankDirection = FILES * fileDirection;
    const turnPawns = this.getPieceColorBitboard(Piece.PAWN, turnColor);
    const lastRow = Bitboard.RANKS[turnColor ? 0 : LAST_RANK];

    if (!onlyCaptures) {
      // Double pawn pushes: pawns at their first rank, with nothing in the next two rows
      const doublePawnPushed = turnPawns.dup().and(Bitboard.RANKS[turnColor ? 6 : 1]).shiftLeft(2 * rankDirection).and_not(occupied).and_not(occupied.dup().shiftLeft(rankDirection));
      addPawnMoves(doublePawnPushed, 2 * rankDirection, Kind.DOUBLE_PAWN_PUSH);
      // One square on to an empty square; to the last row, a promotion
      const positionalPawnMoved = turnPawns.dup().shiftLeft(rankDirection).and_not(occupied);
      addPawnMoves(positionalPawnMoved.dup().and_not(lastRow), rankDirection, Kind.POSITIONAL);
      addPawnPromotions(positionalPawnMoved.dup().and(lastRow), rankDirection, false);
    }

    // Pawn captures: diagonally on to an opponent's piece, not wrapping the board; to the last row, a promotion
    const leftFile = Bitboard.FILES[turnColor ? LAST_FILE : 0];
    const leftCaptureMovement = rankDirection - fileDirection;
    const pawnLeftCaptured = turnPawns.dup().and_not(leftFile).shiftLeft(leftCaptureMovement).and(opponentBB);
    addPawnMoves(pawnLeftCaptured.dup().and_not(lastRow), leftCaptureMovement, Kind.CAPTURE);
    addPawnPromotions(pawnLeftCaptured.dup().and(lastRow), leftCaptureMovement, true);

    const rightFile = Bitboard.FILES[turnColor ? 0 : LAST_FILE];
    const rightCaptureMovement = rankDirection + fileDirection;
    const pawnRightCaptured = turnPawns.dup().and_not(rightFile).shiftLeft(rightCaptureMovement).and(opponentBB);
    addPawnMoves(pawnRightCaptured.dup().and_not(lastRow), rightCaptureMovement, Kind.CAPTURE);
    addPawnPromotions(pawnRightCaptured.dup().and(lastRow), rightCaptureMovement, true);

    // En passant: the opponent just double-pushed beside our pawn; we move diagonally behind it, taking it
    if (this.canEnPassant()) {
      const pawnLeftEnPassant = Bitboard.makeIndex(this.getEnPassantSquare() + fileDirection).and(turnPawns).and_not(leftFile).shiftLeft(leftCaptureMovement);
      addPawnMoves(pawnLeftEnPassant, leftCaptureMovement, Kind.EN_PASSANT_CAPTURE);
      const pawnRightEnPassant = Bitboard.makeIndex(this.getEnPassantSquare() - fileDirection).and(turnPawns).and_not(rightFile).shiftLeft(rightCaptureMovement);
      addPawnMoves(pawnRightEnPassant, rightCaptureMovement, Kind.EN_PASSANT_CAPTURE);
    }

    // Knight, bishop, rook, queen, king
    const addNormalMoves = (from: number, toMask: Bitboard, piece: Piece) => {
      while (!toMask.isEmpty()) {
        const to = toMask.extractLowestBitPosition();
        moves.push(new Move(from, to, opponentBB.isSet(to) ? Kind.CAPTURE : Kind.POSITIONAL, piece, this.getPieceAtOrNull(to)));
      }
    };

    const mask = this.getColorBitboard(turnColor).dup().not();
    if (onlyCaptures) {
      mask.and(opponentBB);
    }

    const turnKnights = this.getPieceColorBitboard(Piece.KNIGHT, turnColor);
    while (!turnKnights.isEmpty()) {
      const knightPosition = turnKnights.extractLowestBitPosition();
      addNormalMoves(knightPosition, Bitboard.KNIGHT_MOVEMENTS[knightPosition].dup().and(mask), Piece.KNIGHT);
    }

    const turnQueens = this.getPieceColorBitboard(Piece.QUEEN, turnColor);
    while (!turnQueens.isEmpty()) {
      const queenPosition = turnQueens.extractLowestBitPosition();
      addNormalMoves(queenPosition, makeBishopAttackMask(Bitboard.makeIndex(queenPosition), occupied).or(
        makeRookAttackMask(Bitboard.makeIndex(queenPosition), occupied)).and(mask), Piece.QUEEN);
    }

    const turnBishops = this.getPieceColorBitboard(Piece.BISHOP, turnColor);
    while (!turnBishops.isEmpty()) {
      const bishopPosition = turnBishops.extractLowestBitPosition();
      addNormalMoves(bishopPosition, makeBishopAttackMask(Bitboard.makeIndex(bishopPosition), occupied).and(mask), Piece.BISHOP);
    }

    const turnRooks = this.getPieceColorBitboard(Piece.ROOK, turnColor);
    while (!turnRooks.isEmpty()) {
      const rookPosition = turnRooks.extractLowestBitPosition();
      addNormalMoves(rookPosition, makeRookAttackMask(Bitboard.makeIndex(rookPosition), occupied).and(mask), Piece.ROOK);
    }

    const kingPosition = this.getKingPosition(turnColor);
    addNormalMoves(kingPosition, Bitboard.KING_MOVEMENTS[kingPosition].dup().and(mask), Piece.KING);

    if (!onlyCaptures) {
      // Chess960: the king's move on to its rook.
      if (this.canCastle(turnColor, true, true)) {
        moves.push(new Move(kingPosition, this.chess960 ? this.rookSquare(turnColor, true) : kingPosition + 2, Kind.KING_CASTLE, Piece.KING, null));
      }
      if (this.canCastle(turnColor, false, true)) {
        moves.push(new Move(kingPosition, this.chess960 ? this.rookSquare(turnColor, false) : kingPosition - 2, Kind.QUEEN_CASTLE, Piece.KING, null));
      }
    }

    return moves;
  }

  capturePiece(piece: Piece, color: PieceColor, index: number): void {
    this.getPieceBitboard(piece).clearBit(index);
    this.getColorBitboard(color).clearBit(index);
    this.pieces[index] = null;
    this.hashKey.updatePieceColorSquare(piece, color, index);
  }

  unCapturePiece(piece: Piece, color: PieceColor, index: number): void {
    this.getPieceBitboard(piece).setBit(index);
    this.getColorBitboard(color).setBit(index);
    this.pieces[index] = piece;
    this.hashKey.updatePieceColorSquare(piece, color, index);
  }

  movePiece(piece: Piece, color: PieceColor, from: number, to: number): void {
    const fromToBB = Bitboard.makeIndex(from).or(Bitboard.makeIndex(to));
    this.getPieceBitboard(piece).xor(fromToBB);
    this.getColorBitboard(color).xor(fromToBB);
    this.pieces[from] = null;
    this.pieces[to] = piece;
    this.hashKey.updatePieceColorSquare(piece, color, from);
    this.hashKey.updatePieceColorSquare(piece, color, to);
  }

  /** Moves the castling rook only (the king moves as any piece). */
  castleRook(color: PieceColor, kingSide: boolean): void {
    const from = this.rookSquare(color, kingSide);
    const to = from + (kingSide ? -2 : 3);
    this.movePiece(Piece.ROOK, color, from, to);
  }

  unCastleRook(color: PieceColor, kingSide: boolean): void {
    const to = this.rookSquare(color, kingSide);
    const from = to + (kingSide ? -2 : 3);
    this.movePiece(Piece.ROOK, color, from, to);
  }

  promotePiece(pieceOld: Piece, pieceNew: Piece, color: PieceColor, index: number): void {
    this.getPieceBitboard(pieceOld).clearBit(index);
    this.getPieceBitboard(pieceNew).setBit(index);
    this.pieces[index] = pieceNew;
    this.hashKey.updatePieceColorSquare(pieceOld, color, index);
    this.hashKey.updatePieceColorSquare(pieceNew, color, index);
  }

  // A Chess960 castling, made (back: taken back): king and rook off their
  // squares, then on to theirs (the squares may be each other's).
  castle960(move: Move, back: boolean): void {
    const color = this.getTurnColor(), kingSide = move.getKind() === Kind.KING_CASTLE;
    const base = color === PieceColor.WHITE ? 0 : 56;
    const king = move.getFrom(), rook = move.getTo(), kingTo = base + (kingSide ? 6 : 2), rookTo = base + (kingSide ? 5 : 3);
    this.capturePiece(Piece.KING, color, back ? kingTo : king);
    this.capturePiece(Piece.ROOK, color, back ? rookTo : rook);
    this.unCapturePiece(Piece.KING, color, back ? king : kingTo);
    this.unCapturePiece(Piece.ROOK, color, back ? rook : rookTo);
  }

  /** Changes the pieces for a move (not the turn, rights or clocks). */
  updatePieces(move: Move): void {
    if (this.chess960 && move.isCastle()) {
      this.castle960(move, false);
      return;
    }
    if (move.isCapture()) {
      this.capturePiece(move.getCapturedPiece(), getOtherPieceColor(this.getTurnColor()), move.getCaptureSquare());
    }
    if (move.isCastle()) {
      this.castleRook(this.getTurnColor(), move.getKind() === Kind.KING_CASTLE);
    }
    this.movePiece(move.getPiece(), this.getTurnColor(), move.getFrom(), move.getTo());
    if (move.isPromotion()) {
      this.promotePiece(Piece.PAWN, move.getPromotedPiece(), this.getTurnColor(), move.getTo());
    }
  }

  revertPieces(move: Move): void {
    if (this.chess960 && move.isCastle()) {
      this.castle960(move, true);
      return;
    }
    if (move.isPromotion()) {
      this.promotePiece(move.getPromotedPiece(), Piece.PAWN, this.getTurnColor(), move.getTo());
    }
    this.movePiece(move.getPiece(), this.getTurnColor(), move.getTo(), move.getFrom());
    if (move.isCastle()) {
      this.unCastleRook(this.getTurnColor(), move.getKind() === Kind.KING_CASTLE);
    }
    if (move.isCapture()) {
      this.unCapturePiece(move.getCapturedPiece(), getOtherPieceColor(this.getTurnColor()), move.getCaptureSquare());
    }
  }

  /** A pseudo-legal move leaves the king out of check. */
  isMoveLegal(move: Move): boolean {
    this.updatePieces(move);
    const kingInCheck = this.isKingInCheck();
    this.revertPieces(move);
    return !kingInCheck;
  }

  /** Makes a pseudo-legal move; false, and nothing changed, when it leaves the king in check. */
  makeMove(move: Move): boolean {
    this.hashHistory.push(this.hashKey.dup());
    this.updatePieces(move);

    if (this.isKingInCheck()) {
      this.revertPieces(move);
      this.hashHistory.pop();
      return false;
    }

    this.madeMoves.push(move);
    this.irreversibleHistory.push(this.enPassantSquare);
    this.irreversibleHistory.push(this.castlingRights);
    this.irreversibleHistory.push(this.halfmoveClock);

    this.hashKey.updateEnPassantSquare(this.enPassantSquare);
    if (move.getKind() === Kind.DOUBLE_PAWN_PUSH) {
      this.enPassantSquare = move.getTo();
    } else {
      this.enPassantSquare = -1;
    }
    this.hashKey.updateEnPassantSquare(this.enPassantSquare);

    const turnColor = this.getTurnColor();

    if (move.getPiece() === Piece.KING) {
      this.clearCastlingRight(turnColor, true);
      this.clearCastlingRight(turnColor, false);
    } else if (move.getPiece() === Piece.ROOK) {
      if (move.getFrom() === this.rookSquare(turnColor, true)) {
        this.clearCastlingRight(turnColor, true);
      } else if (move.getFrom() === this.rookSquare(turnColor, false)) {
        this.clearCastlingRight(turnColor, false);
      }
    }

    const otherColor = getOtherPieceColor(turnColor);

    if (move.isCapture() && move.getCapturedPiece() === Piece.ROOK) {
      if (move.getCaptureSquare() === this.rookSquare(otherColor, true)) {
        this.clearCastlingRight(otherColor, true);
      } else if (move.getCaptureSquare() === this.rookSquare(otherColor, false)) {
        this.clearCastlingRight(otherColor, false);
      }
    }

    if (move.isCapture() || move.getPiece() === Piece.PAWN) {
      this.halfmoveClock = 0;
    } else {
      ++this.halfmoveClock;
    }

    if (turnColor === PieceColor.BLACK) {
      ++this.fullmoveNumber;
    }

    this.turn = otherColor;
    this.hashKey.updateTurn();

    return true;
  }

  getMadeMoveCount(): number {
    return this.madeMoves.length;
  }

  canUndo(): boolean {
    return !!this.getMadeMoveCount();
  }

  getLastMove(): Move | null {
    if (!this.canUndo()) {
      return null;
    }
    return this.madeMoves[this.madeMoves.length - 1];
  }

  /** Takes the last move back; null when there is none. */
  unmakeMove(): Move | null {
    if (!this.canUndo()) {
      return null;
    }
    const move = this.madeMoves.pop() as Move;
    this.turn = getOtherPieceColor(this.getTurnColor());
    this.hashKey.updateTurn();
    if (this.turn === PieceColor.BLACK) {
      --this.fullmoveNumber;
    }
    this.revertPieces(move);
    this.halfmoveClock = this.irreversibleHistory.pop() as number;
    this.hashKey.updateCastlingRights(this.castlingRights);
    this.castlingRights = this.irreversibleHistory.pop() as number;
    this.hashKey.updateCastlingRights(this.castlingRights);
    this.hashKey.updateEnPassantSquare(this.enPassantSquare);
    this.enPassantSquare = this.irreversibleHistory.pop() as number;
    this.hashKey.updateEnPassantSquare(this.enPassantSquare);
    this.hashHistory.pop();
    return move;
  }
}
