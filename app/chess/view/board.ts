// The board, drawn in vg: 8 x 8 squares, light and dark, the files and
// ranks around them, the pieces as the Unicode chess glyphs, the last move
// and a king in check marked; white at the bottom, or black when the board
// is flipped (board.flip). Every square and glyph is bound to the view's
// `shown` state, so a refresh redraws only what changed.
//
// The scene's viewBox is 0 0 88 88: a 4-unit margin for the coordinates,
// and squares of 10 from (4, 4) to (84, 84). A square on screen is at
// column c and row r from the top left; which board square that is depends
// on the flip (squareAt).
import { FILE_CHARACTERS, RANK_CHARACTERS, getIndex, getPieceCharacter, isLight } from "../chess.ts";
import type { ChessView, Shown } from "./view.ts";

export const VIEW = 88;
export const MARGIN = 4;
export const SQUARE = 10;

export const COLOURS = {
  light: "#f0d9b5",
  dark: "#b58863",
  lastLight: "#cdd26a",
  lastDark: "#aaa23a",
  check: "#e05050",
  selected: "#7fb3d5",
  target: "#3a7d44",
  frame: "#8b6b4a",
  coordinate: "#f4ecd8",
  piece: "#111111",
} as const;

/** The board square (0-63) shown at column c, row r from the top left. */
export function squareAt(c: number, r: number, flipped: boolean): number {
  return flipped ? getIndex(r, 7 - c) : getIndex(7 - r, c);
}

/** The glyph of a FEN letter ("" for none): the outlined set for white, the solid for black, as printed boards have them. */
export function glyphOf(letter: string): string {
  if (!letter) return "";
  return getPieceCharacter("PNBRQK".indexOf(letter.toUpperCase()) as 0, letter === letter.toUpperCase() ? 0 : 1);
}

export function squareFill(s: Shown, index: number): string {
  const light = isLight(Math.floor(index / 8), index % 8);
  if (index === s.check) return COLOURS.check;
  if (index === s.selected) return COLOURS.selected;
  if (index === s.lastFrom || index === s.lastTo) return light ? COLOURS.lastLight : COLOURS.lastDark;
  return light ? COLOURS.light : COLOURS.dark;
}

/** The board scene; its handle. */
export function board(v: ChessView): number {
  const shown = () => v.shown.value;
  return vg.scene(`0 0 ${VIEW} ${VIEW}`, 480, 480, () => {
    vg.rect(0, 0, VIEW, VIEW, () => vg.fill(COLOURS.frame));
    for (let r = 0; r < 8; ++r) {
      for (let c = 0; c < 8; ++c) {
        const x = MARGIN + c * SQUARE, y = MARGIN + r * SQUARE;
        const at = () => squareAt(c, r, shown().flipped);
        vg.rect(x, y, SQUARE, SQUARE, () => vg.bind_fill(() => squareFill(shown(), at())));
        vg.text_anchored(x + SQUARE / 2, y + SQUARE * 0.82, 8.5, "middle", "", () => {
          vg.fill(COLOURS.piece);
          vg.bind_text(() => glyphOf(shown().pieces[at()] ?? ""));
        });
      }
    }
    // The files along the bottom and the ranks down the left, as the flip has them.
    for (let i = 0; i < 8; ++i) {
      vg.text_anchored(MARGIN + i * SQUARE + SQUARE / 2, VIEW - 0.8, 3, "middle", "", () => {
        vg.fill(COLOURS.coordinate);
        vg.bind_text(() => FILE_CHARACTERS[shown().flipped ? 7 - i : i]);
      });
      vg.text_anchored(MARGIN / 2, MARGIN + i * SQUARE + SQUARE / 2 + 1, 3, "middle", "", () => {
        vg.fill(COLOURS.coordinate);
        vg.bind_text(() => RANK_CHARACTERS[shown().flipped ? i : 7 - i]);
      });
    }
  });
}

/** The board square under viewBox point (x, y), or -1 off the board. */
export function squareUnder(x: number, y: number, flipped: boolean): number {
  const c = Math.floor((x - MARGIN) / SQUARE), r = Math.floor((y - MARGIN) / SQUARE);
  return c < 0 || c > 7 || r < 0 || r > 7 ? -1 : squareAt(c, r, flipped);
}

