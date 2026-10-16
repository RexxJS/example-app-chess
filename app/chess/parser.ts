// parser.ts: chess notation in and out. A port of src/parser.js from Kaj
// Björklund's JavaScript Chess (https://github.com/kbjorklu/chess, MIT,
// copyright (c) 2013 Kaj Björklund; LICENSE), to sae's TypeScript dialect:
// clean(), parseOneMove() and parseMoves() as they were (a game's text,
// "1. e4 c5 (a comment) 2. Nf3", played out from the start), and new
// beside them: FEN read (fromFen, with what is wrong said) and written
// (toFen), one move from text (parseMove: coordinate "e2e4", "e7e8q", or
// SAN "Nf3", "O-O", "exd5", "e8=Q", "Nbd7", "Qxe4+"), and a move's SAN
// for a position (toSan, with "+" and "#").
import { FILE_CHARACTERS, RANK_CHARACTERS, PIECE_ALGEBRAIC_NAMES, Piece, PieceColor, getFile, getRank, getIndex, getIndexFromAlgebraic, getAlgebraicFromIndex } from "./chess.ts";
import type { Piece as PieceKind, PieceColor as Color } from "./chess.ts";
import { Move, Kind } from "./move.ts";
import { Position } from "./position.ts";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Normalises whitespace and dashes, strips comments in (nested) parentheses and every uninteresting character. */
export function clean(text: string): string {
  text = text.replace(/[\r\n\t]/gm, " "); // whitespace to spaces
  text = text.replace(/[-־᠆‐‑‒–—―⁻₋−⸺⸻﹘﹣－]/g, "-"); // dashes
  for (;;) { // comments: (nested) parentheses and what is between them
    const replaced = text.replace(/\([^()]*\)/g, "");
    if (replaced === text) break;
    text = replaced;
  }
  text = text.replace(/[^ a-z0-9.=:½-]/gi, " "); // only the interesting characters
  text = text.replace(/  +/g, " ");
  return text;
}

/**
 * The legal moves `text` names: castling ("0-0", "O-O-O"), or a piece,
 * from-file, from-rank, capture, to-square and promotion, each optional
 * where SAN leaves it out. Null when the text is no move at all; several
 * when it is ambiguous. Coordinate notation ("e2e4", "e7e8q") is a case
 * of it: file and rank given for both squares.
 */
export function parseOneMove(position: Position, text: string): Move[] | null {
  const legalMoves = position.getMoves();
  text = text.replace(/[+#!?]+$/, "");

  const castling = text.match(/^(?:0-0(?:-0)?|O-O(?:-O)?)$/i);
  if (castling) {
    const kind = (castling[0].length === 3) ? Kind.KING_CASTLE : Kind.QUEEN_CASTLE;
    return legalMoves.filter((move) => move.getKind() === kind);
  }

  const m = text.match(/^([NBRQK])?([a-h])?([1-8])?-?([x:])?([a-h])([1-8])?(?:=?\(?([NBRQnbrq])\)?)?$/);
  if (m) {
    const piece = m[1];
    const fromFile = m[2];
    const fromRank = m[3];
    const capture = m[4];
    const toFile = m[5];
    const toRank = m[6];
    const promotedPiece = m[7]?.toUpperCase();
    // "g1f3": both squares whole and no piece letter is coordinate notation, of any piece.
    const coordinate = piece === undefined && fromFile !== undefined && fromRank !== undefined;
    const found = legalMoves.filter((move) => {
      if (piece !== undefined && PIECE_ALGEBRAIC_NAMES[move.getPiece()] !== piece) return false;
      if (piece === undefined && !coordinate && move.getPiece() !== Piece.PAWN) return false;
      if (fromFile !== undefined && FILE_CHARACTERS[getFile(move.getFrom())] !== fromFile) return false;
      if (fromRank !== undefined && RANK_CHARACTERS[getRank(move.getFrom())] !== fromRank) return false;
      if (capture !== undefined && !move.isCapture()) return false;
      if (toFile !== undefined && FILE_CHARACTERS[getFile(move.getTo())] !== toFile) return false;
      if (toRank !== undefined && RANK_CHARACTERS[getRank(move.getTo())] !== toRank) return false;
      if (promotedPiece !== undefined && PIECE_ALGEBRAIC_NAMES[move.getPromotedPiece()] !== promotedPiece) return false;
      if (promotedPiece === undefined && move.isPromotion() && move.getPromotedPiece() !== Piece.QUEEN) return false; // "e8" alone is the queen
      return true;
    });
    // Chess960: the king's castling move named by where the king ends ("b1g1"), as well as by its rook's square.
    if (!found.length && coordinate && position.chess960 && toRank !== undefined) {
      const from = FILE_CHARACTERS.indexOf(fromFile) + 8 * RANK_CHARACTERS.indexOf(fromRank), to = FILE_CHARACTERS.indexOf(toFile) + 8 * RANK_CHARACTERS.indexOf(toRank);
      return legalMoves.filter((move) => move.isCastle() && move.getFrom() === from && getFile(to) === (move.getKind() === Kind.KING_CASTLE ? 6 : 2) && getRank(to) === getRank(from));
    }
    return found;
  }

  return null;
}

/** The one legal move `text` names, or null (no such move, or ambiguous). */
export function parseMove(position: Position, text: string): Move | null {
  const moves = parseOneMove(position, text.trim());
  return moves && moves.length === 1 ? moves[0] : null;
}

/** A game's moves from text, played from the start (or from `from`); throws at the first it cannot read. */
export function parseMoves(text: string, from?: Position): Position {
  const position = from ?? new Position();
  clean(text).split(" ").every((moveText) => {
    if (moveText === "" || /^\d+\.+$/.test(moveText)) return true;
    if (/^(1-0|0-1|½-½|1\/2-1\/2|\*)$/.test(moveText)) return false;
    const stripped = moveText.replace(/^\d+\.+/, ""); // "1.e4"
    const moves = parseOneMove(position, stripped);
    if (!moves || moves.length !== 1) {
      throw new Error("Parse error in '" + moveText + "'");
    }
    position.makeMove(moves[0]);
    return true;
  });
  return position;
}

/** Standard algebraic notation for a legal move in `position` (which is left as it was). */
export function toSan(position: Position, move: Move): string {
  let san: string;
  if (move.isCastle()) {
    san = move.getKind() === Kind.KING_CASTLE ? "O-O" : "O-O-O";
  } else {
    const piece = move.getPiece();
    const to = getAlgebraicFromIndex(move.getTo());
    if (piece === Piece.PAWN) {
      san = (move.isCapture() ? FILE_CHARACTERS[getFile(move.getFrom())] + "x" : "") + to;
      if (move.isPromotion()) san += "=" + PIECE_ALGEBRAIC_NAMES[move.getPromotedPiece()];
    } else {
      // Others of the same kind that could go there: say the file, else the rank, else both.
      const others = position.getMoves().filter((m) => m.getPiece() === piece && m.getTo() === move.getTo() && m.getFrom() !== move.getFrom());
      let from = "";
      if (others.length) {
        const file = getFile(move.getFrom()), rank = getRank(move.getFrom());
        if (!others.some((m) => getFile(m.getFrom()) === file)) from = FILE_CHARACTERS[file];
        else if (!others.some((m) => getRank(m.getFrom()) === rank)) from = RANK_CHARACTERS[rank];
        else from = FILE_CHARACTERS[file] + RANK_CHARACTERS[rank];
      }
      san = PIECE_ALGEBRAIC_NAMES[piece] + from + (move.isCapture() ? "x" : "") + to;
    }
  }
  if (position.makeMove(move)) {
    const check = position.isKingInCheck();
    const mate = check && position.getMoves().length === 0;
    position.unmakeMove();
    if (mate) san += "#";
    else if (check) san += "+";
  }
  return san;
}

/**
 * The castling rights as FEN has them: KQkq, or (Chess960, X-FEN) the
 * rook's file where the rook is not the outermost on its side: "HAha"
 * reads "KQkq" when those rooks are the outermost.
 */
function castlingText(position: Position): string {
  let out = "";
  for (const color of [PieceColor.WHITE, PieceColor.BLACK]) {
    for (const kingSide of [true, false]) {
      if (!position.hasCastlingRight(color as Color, kingSide)) continue;
      const rook = position.rookSquare(color as Color, kingSide), base = color === PieceColor.WHITE ? 0 : 56;
      let outermost = true;
      for (let f = getFile(rook) + (kingSide ? 1 : -1); f >= 0 && f <= 7; f += kingSide ? 1 : -1) {
        if (position.getPieceAtOrNull(base + f) === Piece.ROOK && position.getColorAtOrNull(base + f) === color) outermost = false;
      }
      const letter = outermost ? (kingSide ? "K" : "Q") : FILE_CHARACTERS[getFile(rook)].toUpperCase();
      out += color === PieceColor.WHITE ? letter : letter.toLowerCase();
    }
  }
  return out;
}

/**
 * Reads FEN's castling field into the position: KQkq (the outermost rook
 * on that side of the king), or X-FEN and Shredder-FEN's files ("HAha",
 * "Bb"). A right with no rook of its side there is dropped. A king or a
 * castling rook off the usual squares makes the position Chess960.
 */
function readCastling(p: Position, castling: string): void {
  p.castlingRights = 0;
  p.castleRooks = [7, 63, 0, 56];
  let odd = false;
  for (const ch of castling === "-" ? "" : castling) {
    const color = ch === ch.toUpperCase() ? PieceColor.WHITE : PieceColor.BLACK;
    const base = color === PieceColor.WHITE ? 0 : 56;
    const king = p.getKingPosition(color as Color);
    if (king < base || king > base + 7) continue;
    const isRook = (sq: number) => p.getPieceAtOrNull(sq) === Piece.ROOK && p.getColorAtOrNull(sq) === color;
    let rook = -1;
    const c = ch.toUpperCase();
    if (c === "K") for (let f = 7; f > getFile(king) && rook < 0; --f) { if (isRook(base + f)) rook = base + f; }
    else if (c === "Q") for (let f = 0; f < getFile(king) && rook < 0; ++f) { if (isRook(base + f)) rook = base + f; }
    else if (isRook(base + FILE_CHARACTERS.indexOf(c.toLowerCase()))) rook = base + FILE_CHARACTERS.indexOf(c.toLowerCase());
    if (rook < 0 || rook === king) continue;
    const kingSide = getFile(rook) > getFile(king);
    const index = (color as number) + (kingSide ? 0 : 2);
    p.castlingRights |= 1 << index;
    p.castleRooks[index] = rook;
    if (getFile(king) !== 4 || getFile(rook) !== (kingSide ? 7 : 0)) odd = true;
  }
  p.chess960 = odd;
}

/** The position as FEN. */
export function toFen(position: Position): string {
  const ranks: string[] = [];
  for (let rank = 7; rank >= 0; --rank) {
    let line = "", empty = 0;
    for (let file = 0; file < 8; ++file) {
      const index = getIndex(rank, file);
      const piece = position.getPieceAtOrNull(index);
      if (piece === null) { ++empty; continue; }
      if (empty) { line += empty; empty = 0; }
      const letter = piece === Piece.PAWN ? "P" : PIECE_ALGEBRAIC_NAMES[piece];
      line += position.getColorAtOrNull(index) === PieceColor.WHITE ? letter : letter.toLowerCase();
    }
    if (empty) line += empty;
    ranks.push(line);
  }
  const castling = castlingText(position);
  const ep = position.enPassantSquare;
  const epText = ep < 0 ? "-" : getAlgebraicFromIndex(position.turn === PieceColor.WHITE ? ep + 8 : ep - 8);
  return `${ranks.join("/")} ${position.turn === PieceColor.WHITE ? "w" : "b"} ${castling || "-"} ${epText} ${position.halfmoveClock} ${position.fullmoveNumber}`;
}

/** A position from FEN; throws an Error saying what is wrong with it. */
export function fromFen(fen: string): Position {
  const fields = fen.trim().split(/\s+/);
  if (fields.length < 2 || fields.length > 6) throw new Error(`FEN: 2 to 6 fields, not ${fields.length}`);
  const [board, turn, castling = "-", ep = "-", halfmove = "0", fullmove = "1"] = fields;
  const ranks = board.split("/");
  if (ranks.length !== 8) throw new Error(`FEN: 8 ranks, not ${ranks.length}`);
  const p = Position.empty();
  const kings = [0, 0];
  for (let r = 0; r < 8; ++r) {
    let file = 0;
    for (const ch of ranks[r]) {
      if (ch >= "1" && ch <= "8") { file += Number(ch); continue; }
      const letter = ch.toUpperCase();
      const piece = letter === "P" ? Piece.PAWN : PIECE_ALGEBRAIC_NAMES.indexOf(letter);
      if (piece <= 0 && letter !== "P") throw new Error(`FEN: no piece '${ch}' in rank ${8 - r}`);
      if (file > 7) break;
      const color: Color = ch === letter ? PieceColor.WHITE : PieceColor.BLACK;
      if (piece === Piece.KING) kings[color]++;
      p.putPiece(piece as PieceKind, color, getIndex(7 - r, file));
      file++;
    }
    if (file !== 8) throw new Error(`FEN: rank ${8 - r} has ${file} squares, not 8`);
  }
  if (kings[0] !== 1 || kings[1] !== 1) throw new Error(`FEN: one king each, not ${kings[0]} white and ${kings[1]} black`);
  if (turn !== "w" && turn !== "b") throw new Error(`FEN: side to move is w or b, not '${turn}'`);
  p.turn = turn === "w" ? PieceColor.WHITE : PieceColor.BLACK;
  if (!/^(-|[KQA-H]{0,2}[kqa-h]{0,2})$/.test(castling) || castling === "") throw new Error(`FEN: castling rights are KQkq (or a rook's file, "HAha", for Chess960) or -, not '${castling}'`);
  readCastling(p, castling);
  if (ep !== "-") {
    const behind = getIndexFromAlgebraic(ep);
    const rank = behind < 0 ? -1 : getRank(behind);
    if (rank !== (p.turn === PieceColor.WHITE ? 5 : 2)) throw new Error(`FEN: en passant square '${ep}' is not on rank ${p.turn === PieceColor.WHITE ? 6 : 3}`);
    // The engine keeps the square the pawn moved to, not the one behind it.
    p.enPassantSquare = p.turn === PieceColor.WHITE ? behind - 8 : behind + 8;
  }
  if (!/^\d+$/.test(halfmove) || !/^[1-9]\d*$/.test(fullmove)) throw new Error(`FEN: the clocks are numbers, not '${halfmove}' and '${fullmove}'`);
  p.halfmoveClock = Number(halfmove);
  p.fullmoveNumber = Number(fullmove);
  p.updateHashKey();
  // The side that has just moved cannot be left in check: its king would be taken.
  const moved = p.turn === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;
  if (p.isAttacked(p.turn, p.getKingPosition(moved))) throw new Error(`FEN: ${moved === PieceColor.WHITE ? "white" : "black"} is in check with ${p.turn === PieceColor.WHITE ? "white" : "black"} to move`);
  return p;
}
