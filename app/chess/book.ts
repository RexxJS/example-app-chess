// The opening book (TODO.md 6.3): a small book of named openings, written
// for this app from the openings' public names and their moves (no other
// program's book is in it). Each line is a name and its moves in SAN from
// the start; the book reads every line into the positions it passes
// through, so a game that reaches a line's position by another order of
// moves (a transposition) is in it too.
//
//   openingOf(game)   the name of the last named position the game passed
//                     through: "Ruy Lopez, Morphy Defence"; "" before any
//   bookMoves(game)   the book's moves from the position now, in SAN
//   bookMove(game)    one of them, chosen by the position (the same each
//                     time), for the computer when it plays from the book
//
// A game set up from a position other than the start has no opening.
import { Kind } from "./move.ts";
import type { Position } from "./position.ts";
import { START_FEN, fromFen, parseMove, toFen, toSan } from "./parser.ts";
import type { Game } from "./game.ts";

/** The book: a name, then the moves in SAN from the start. */
export const LINES: readonly (readonly [string, string])[] = [
  ["King's Pawn Opening", "e4"],
  ["Queen's Pawn Opening", "d4"],
  ["English Opening", "c4"],
  ["Réti Opening", "Nf3"],
  ["Bird's Opening", "f4"],
  ["Nimzo-Larsen Attack", "b3"],
  ["Polish Opening", "b4"],
  ["Grob's Attack", "g4"],
  // 1. e4 e5
  ["Open Game", "e4 e5"],
  ["King's Knight Opening", "e4 e5 Nf3"],
  ["Philidor Defence", "e4 e5 Nf3 d6"],
  ["Petrov's Defence", "e4 e5 Nf3 Nf6"],
  ["Latvian Gambit", "e4 e5 Nf3 f5"],
  ["Elephant Gambit", "e4 e5 Nf3 d5"],
  ["Ruy Lopez", "e4 e5 Nf3 Nc6 Bb5"],
  ["Ruy Lopez, Morphy Defence", "e4 e5 Nf3 Nc6 Bb5 a6"],
  ["Ruy Lopez, Exchange Variation", "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6"],
  ["Ruy Lopez, Closed", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7"],
  ["Ruy Lopez, Open", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4"],
  ["Ruy Lopez, Marshall Attack", "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5"],
  ["Ruy Lopez, Berlin Defence", "e4 e5 Nf3 Nc6 Bb5 Nf6"],
  ["Italian Game", "e4 e5 Nf3 Nc6 Bc4"],
  ["Giuoco Piano", "e4 e5 Nf3 Nc6 Bc4 Bc5"],
  ["Evans Gambit", "e4 e5 Nf3 Nc6 Bc4 Bc5 b4"],
  ["Two Knights Defence", "e4 e5 Nf3 Nc6 Bc4 Nf6"],
  ["Two Knights Defence, Fried Liver Attack", "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7"],
  ["Scotch Game", "e4 e5 Nf3 Nc6 d4"],
  ["Scotch Game, Main Line", "e4 e5 Nf3 Nc6 d4 exd4 Nxd4"],
  ["Scotch Gambit", "e4 e5 Nf3 Nc6 d4 exd4 Bc4"],
  ["Ponziani Opening", "e4 e5 Nf3 Nc6 c3"],
  ["Four Knights Game", "e4 e5 Nf3 Nc6 Nc3 Nf6"],
  ["Vienna Game", "e4 e5 Nc3"],
  ["Bishop's Opening", "e4 e5 Bc4"],
  ["King's Gambit", "e4 e5 f4"],
  ["King's Gambit Accepted", "e4 e5 f4 exf4"],
  ["King's Gambit Declined, Falkbeer Countergambit", "e4 e5 f4 d5"],
  ["Centre Game", "e4 e5 d4 exd4 Qxd4"],
  ["Danish Gambit", "e4 e5 d4 exd4 c3"],
  // 1. e4, the others
  ["Sicilian Defence", "e4 c5"],
  ["Sicilian Defence, Closed", "e4 c5 Nc3"],
  ["Sicilian Defence, Alapin Variation", "e4 c5 c3"],
  ["Sicilian Defence, Smith-Morra Gambit", "e4 c5 d4 cxd4 c3"],
  ["Sicilian Defence, Rossolimo Variation", "e4 c5 Nf3 Nc6 Bb5"],
  ["Sicilian Defence, Open", "e4 c5 Nf3 d6 d4 cxd4 Nxd4"],
  ["Sicilian Defence, Najdorf Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6"],
  ["Sicilian Defence, Dragon Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6"],
  ["Sicilian Defence, Scheveningen Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6"],
  ["Sicilian Defence, Classical Variation", "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6"],
  ["Sicilian Defence, Accelerated Dragon", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6"],
  ["Sicilian Defence, Sveshnikov Variation", "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5"],
  ["Sicilian Defence, Taimanov Variation", "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6"],
  ["Sicilian Defence, Kan Variation", "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6"],
  ["French Defence", "e4 e6"],
  ["French Defence, Advance Variation", "e4 e6 d4 d5 e5"],
  ["French Defence, Exchange Variation", "e4 e6 d4 d5 exd5"],
  ["French Defence, Winawer Variation", "e4 e6 d4 d5 Nc3 Bb4"],
  ["French Defence, Classical Variation", "e4 e6 d4 d5 Nc3 Nf6"],
  ["French Defence, Rubinstein Variation", "e4 e6 d4 d5 Nc3 dxe4"],
  ["French Defence, Tarrasch Variation", "e4 e6 d4 d5 Nd2"],
  ["Caro-Kann Defence", "e4 c6"],
  ["Caro-Kann Defence, Advance Variation", "e4 c6 d4 d5 e5"],
  ["Caro-Kann Defence, Exchange Variation", "e4 c6 d4 d5 exd5 cxd5"],
  ["Caro-Kann Defence, Panov Attack", "e4 c6 d4 d5 exd5 cxd5 c4"],
  ["Caro-Kann Defence, Classical Variation", "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5"],
  ["Caro-Kann Defence, Two Knights Variation", "e4 c6 Nc3 d5 Nf3"],
  ["Scandinavian Defence", "e4 d5"],
  ["Scandinavian Defence, Main Line", "e4 d5 exd5 Qxd5 Nc3 Qa5"],
  ["Alekhine's Defence", "e4 Nf6"],
  ["Pirc Defence", "e4 d6 d4 Nf6 Nc3 g6"],
  ["Modern Defence", "e4 g6"],
  ["Owen's Defence", "e4 b6"],
  ["Nimzowitsch Defence", "e4 Nc6"],
  // 1. d4 d5
  ["Queen's Gambit", "d4 d5 c4"],
  ["Queen's Gambit Accepted", "d4 d5 c4 dxc4"],
  ["Queen's Gambit Declined", "d4 d5 c4 e6"],
  ["Queen's Gambit Declined, Exchange Variation", "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5"],
  ["Tarrasch Defence", "d4 d5 c4 e6 Nc3 c5"],
  ["Slav Defence", "d4 d5 c4 c6"],
  ["Semi-Slav Defence", "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6"],
  ["Albin Countergambit", "d4 d5 c4 e5"],
  ["Chigorin Defence", "d4 d5 c4 Nc6"],
  ["London System", "d4 d5 Bf4"],
  ["Colle System", "d4 d5 Nf3 Nf6 e3"],
  // 1. d4 Nf6
  ["Indian Defence", "d4 Nf6"],
  ["Trompowsky Attack", "d4 Nf6 Bg5"],
  ["Torre Attack", "d4 Nf6 Nf3 e6 Bg5"],
  ["King's Indian Defence", "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6"],
  ["Grünfeld Defence", "d4 Nf6 c4 g6 Nc3 d5"],
  ["Nimzo-Indian Defence", "d4 Nf6 c4 e6 Nc3 Bb4"],
  ["Queen's Indian Defence", "d4 Nf6 c4 e6 Nf3 b6"],
  ["Bogo-Indian Defence", "d4 Nf6 c4 e6 Nf3 Bb4+"],
  ["Catalan Opening", "d4 Nf6 c4 e6 g3"],
  ["Benoni Defence", "d4 Nf6 c4 c5 d5"],
  ["Modern Benoni", "d4 Nf6 c4 c5 d5 e6"],
  ["Benko Gambit", "d4 Nf6 c4 c5 d5 b5"],
  ["Budapest Gambit", "d4 Nf6 c4 e5"],
  ["Old Indian Defence", "d4 Nf6 c4 d6"],
  ["Dutch Defence", "d4 f5"],
  ["Dutch Defence, Leningrad Variation", "d4 f5 g3 Nf6 Bg2 g6"],
  ["Dutch Defence, Stonewall Variation", "d4 f5 c4 Nf6 g3 e6 Bg2 d5"],
  // 1. c4, 1. Nf3
  ["English Opening, Symmetrical Variation", "c4 c5"],
  ["English Opening, Reversed Sicilian", "c4 e5"],
  ["English Opening, Anglo-Indian Defence", "c4 Nf6"],
  ["Réti Opening, Réti Gambit", "Nf3 d5 c4"],
  ["King's Indian Attack", "Nf3 d5 g3"],
];

// A position as the book knows it: the board, the side to move, the
// castling rights, and the en passant square only when a capture there is
// legal (the engine keeps one after every double step).
export function bookKey(position: Position): string {
  const [board, turn, castling, ep] = toFen(position).split(" ");
  const epLive = ep !== "-" && position.getMoves().some((m) => m.getKind() === Kind.EN_PASSANT_CAPTURE);
  return `${board} ${turn} ${castling} ${epLive ? ep : "-"}`;
}

interface Entry {
  name: string;                       // "" for a position no line ends at
  readonly moves: string[];           // the book's moves from it, in SAN
}

let BOOK: Map<string, Entry> | null = null;

/** The book's positions, read from LINES once: each with its name (where a line ends) and the moves the lines go on by. */
export function book(): Map<string, Entry> {
  if (BOOK) return BOOK;
  const map = new Map<string, Entry>();
  const entry = (key: string) => {
    let e = map.get(key);
    if (!e) map.set(key, (e = { name: "", moves: [] }));
    return e;
  };
  for (const [name, line] of LINES) {
    const p = fromFen(START_FEN);
    for (const text of line.split(" ")) {
      const move = parseMove(p, text);
      if (!move) throw new Error(`the book: ${name}: ${text} is not legal there`);
      const san = toSan(p, move);
      const e = entry(bookKey(p));
      if (!e.moves.includes(san)) e.moves.push(san);
      p.makeMove(move);
    }
    const end = entry(bookKey(p));
    if (end.name && end.name !== name) throw new Error(`the book: ${name} and ${end.name} end at the same position`);
    end.name = name;
  }
  BOOK = map;
  return map;
}

/** The name of the last named position the game passed through (its start included), or "" (before any, or a game set up from another position). */
export function openingOf(game: Game): string {
  if (game.startFen !== START_FEN) return "";
  const b = book();
  const p = fromFen(START_FEN);
  let name = "";
  for (const m of game.made) {
    p.makeMove(m.move);
    const e = b.get(bookKey(p));
    if (e?.name) name = e.name;
  }
  return name;
}

/** The book's moves from the position now, in SAN ([] when it is out of the book). */
export function bookMoves(game: Game): string[] {
  if (game.isOver() || game.startFen !== START_FEN) return [];
  return [...(book().get(bookKey(game.position))?.moves ?? [])];
}

/** One of the book's moves, chosen by the position (so the same position gives the same move), as coordinate notation; null out of the book. */
export function bookMove(game: Game): string | null {
  const moves = bookMoves(game);
  if (!moves.length) return null;
  let h = 0x811c9dc5;
  for (const ch of bookKey(game.position)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return game.find(moves[h % moves.length])?.getCoordinate() ?? null;
}
