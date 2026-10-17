// The board in words, for a screen reader (TODO.md 6.6): a square and what
// stands on it ("e4, white knight"), a move as it is said ("e2 to e4",
// "e5 to d4, takes white pawn", "e1 to g1, castles kingside", "e7 to e8,
// becomes a queen, check"), the whole position rank by rank, and the
// keyboard cursor's step across the board as the person sees it (up the
// screen, whichever way round the board is). No ui: the page announces
// these (ui.a11y_announce) and names the board by them, and the control
// functions give them (DESCRIBESQUARE, DESCRIBEBOARD, CURSOR).
import { FILE_CHARACTERS, RANK_CHARACTERS, getAlgebraicFromIndex, getFile, getIndex, getIndexFromAlgebraic, getRank } from "./chess.ts";

const NAMES: Readonly<Record<string, string>> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** A FEN letter as it is said: "white knight", "black pawn"; "" for none. */
export function pieceName(letter: string): string {
  if (!letter) return "";
  const name = NAMES[letter.toLowerCase()];
  return name ? `${letter === letter.toUpperCase() ? "white" : "black"} ${name}` : "";
}

/** A square and what stands on it: "e4, white knight", "e5, empty"; pieces a FEN letter or "" per square, a1 first. */
export function squareText(pieces: readonly string[], index: number): string {
  return `${getAlgebraicFromIndex(index)}, ${pieceName(pieces[index] ?? "") || "empty"}`;
}

/**
 * A move as it is said, from the board before it (pieces), the move in
 * coordinate notation ("e2e4", "e7e8q") and its SAN ("e4", "exd5", "O-O",
 * "e8=Q+"): "e2 to e4", then what it took, a castling, a promotion, a check
 * or mate.
 */
export function moveText(pieces: readonly string[], coordinate: string, san: string): string {
  const from = getIndexFromAlgebraic(coordinate.slice(0, 2)), to = getIndexFromAlgebraic(coordinate.slice(2, 4));
  if (from < 0 || to < 0) return coordinate;
  const parts = [`${coordinate.slice(0, 2)} to ${coordinate.slice(2, 4)}`];
  const mover = pieces[from] ?? "";
  const there = pieces[to] ?? "";
  if (san.startsWith("O-O")) parts.push(san.startsWith("O-O-O") ? "castles queenside" : "castles kingside");
  else if (there) parts.push(`takes ${pieceName(there)}`);
  else if (mover.toLowerCase() === "p" && getFile(from) !== getFile(to)) {
    // En passant: the pawn taken stands beside the square moved to.
    const beside = getIndex(getRank(from), getFile(to));
    parts.push(`takes ${pieceName(pieces[beside] ?? "") || "a pawn"} en passant`);
  }
  if (coordinate.length > 4) parts.push(`becomes a ${NAMES[coordinate[4].toLowerCase()] ?? "queen"}`);
  if (san.endsWith("#")) parts.push("checkmate");
  else if (san.endsWith("+")) parts.push("check");
  return parts.join(", ");
}

/** The position rank by rank, from the 8th down: "8: a8 black rook, b8 black knight, ...; 6: empty; ...". */
export function boardText(pieces: readonly string[]): string {
  const ranks: string[] = [];
  for (let rank = 7; rank >= 0; --rank) {
    const here: string[] = [];
    for (let file = 0; file < 8; ++file) {
      const letter = pieces[getIndex(rank, file)] ?? "";
      if (letter) here.push(`${FILE_CHARACTERS[file]}${RANK_CHARACTERS[rank]} ${pieceName(letter)}`);
    }
    ranks.push(`${RANK_CHARACTERS[rank]}: ${here.length ? here.join(", ") : "empty"}`);
  }
  return ranks.join("; ");
}

export type Step = "up" | "down" | "left" | "right";
export const STEPS: readonly Step[] = ["up", "down", "left", "right"];

/** The square a step across the screen from `index` comes to (the board flipped or not); the same square at the edge. */
export function stepFrom(index: number, step: Step, flipped: boolean): number {
  const sign = flipped ? -1 : 1;
  let rank = getRank(index), file = getFile(index);
  if (step === "up") rank += sign;
  else if (step === "down") rank -= sign;
  else if (step === "right") file += sign;
  else file -= sign;
  return rank < 0 || rank > 7 || file < 0 || file > 7 ? index : getIndex(rank, file);
}
