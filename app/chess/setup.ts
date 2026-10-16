// A position set up square by square (TODO.md 5.2): the editor's board (a
// FEN letter or "" per square, a1 first) and the side to move, as a FEN
// the game can be set to (game.setPosition says what is wrong with one
// that is no position: a king missing, say). Castling rights are given
// where a king and a rook stand on their home squares; no en passant; the
// clocks at the start.
import { START_FEN } from "./parser.ts";

export type Turn = "w" | "b";

/** The squares of a FEN's board, a1 first: a FEN letter or "" each. */
export function piecesOfFen(fen: string): string[] {
  const out: string[] = new Array(64).fill("");
  const ranks = fen.trim().split(/\s+/)[0].split("/");
  ranks.forEach((row, r) => {
    let file = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") file += Number(ch);
      else if (file < 8) out[(7 - r) * 8 + file++] = ch;
    }
  });
  return out;
}

export const START_PIECES = piecesOfFen(START_FEN);

/** The FEN of a board set up so, `turn` to move. */
export function fenOf(pieces: readonly string[], turn: Turn): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; --rank) {
    let row = "", empty = 0;
    for (let file = 0; file < 8; ++file) {
      const p = pieces[rank * 8 + file];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) row += String(empty);
      empty = 0;
      row += p;
    }
    rows.push(empty ? row + String(empty) : row);
  }
  const at = (sq: number, p: string) => pieces[sq] === p;
  const castling = (at(4, "K") && at(7, "R") ? "K" : "") + (at(4, "K") && at(0, "R") ? "Q" : "") +
    (at(60, "k") && at(63, "r") ? "k" : "") + (at(60, "k") && at(56, "r") ? "q" : "");
  return `${rows.join("/")} ${turn} ${castling || "-"} - 0 1`;
}
