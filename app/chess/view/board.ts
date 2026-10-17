// The board, drawn in vg: 8 x 8 squares, light and dark, the files and
// ranks around them, the pieces as the Unicode chess glyphs, the last move
// and a king in check marked; white at the bottom, or black when the board
// is flipped (board.flip). Every square and glyph is bound to the view's
// `shown` state, so a refresh redraws only what changed. A press on a
// piece picks it and dots its targets; a press on a target, or the piece
// dragged and let go over one, moves (ChessView.clickSquare, dropOn).
// From the keyboard, the arrows move a cursor (an outline), Return or
// Space picks and puts down, Escape puts back (ChessView.key), and a
// screen reader is told the board, its squares and its moves (speak.ts).
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
/** The cursor's frame, in viewBox units. */
export const CURSOR_WIDTH = 1.2;

/** The board's colours in the light look; DARK_COLOURS in the dark. */
export const COLOURS = {
  light: "#f0d9b5",
  dark: "#b58863",
  lastLight: "#cdd26a",
  lastDark: "#aaa23a",
  check: "#e05050",
  selected: "#7fb3d5",
  target: "#3a7d44",
  cursor: "#1f5fbf",
  frame: "#8b6b4a",
  coordinate: "#f4ecd8",
  piece: "#111111",
} as const;

export const DARK_COLOURS: { readonly [K in keyof typeof COLOURS]: string } = {
  light: "#9aa8b0",
  dark: "#5a6e7a",
  lastLight: "#b5b86a",
  lastDark: "#8a8c48",
  check: "#c04040",
  selected: "#5f8fb5",
  target: "#2a5d34",
  cursor: "#9cc7ff",
  frame: "#202428",
  coordinate: "#c8ccd0",
  piece: "#0a0a0a",
};

const paletteOf = (s: Shown) => (s.dark ? DARK_COLOURS : COLOURS);

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
  const c = paletteOf(s);
  const light = isLight(Math.floor(index / 8), index % 8);
  if (index === s.check) return c.check;
  if (index === s.selected) return c.selected;
  if (index === s.lastFrom || index === s.lastTo) return light ? c.lastLight : c.lastDark;
  return light ? c.light : c.dark;
}

/**
 * The board, in a column of its own, at the game's board size
 * (view.boardSize): by itself the largest square the window has room for
 * (ChessView.fitBoard, on sae's ui.on_resize), or a size set by hand. A
 * change of size resizes the scene in place (sae's vg.resize): its
 * shapes, bindings and handlers stay. The viewBox fits the canvas
 * uniformly, so the board is square at every size.
 */
export function boardPanel(v: ChessView): void {
  let size = v.cmds.game.boardSize;
  let board = 0;
  ui.vstack(() => { board = scene(v, size); });
  // To a screen reader the board is one element (sae's ui.a11y_* on the
  // scene): named for the game's state, described square by square, and
  // told each move and each square the keyboard's cursor reaches; the
  // keys on it play (ChessView.key: arrows, Return or Space, Escape).
  ui.a11y_role(board, "group");
  v.speaker = {
    announce: (text: string) => {
      ui.a11y_announce(board, text);
      print(`chess: said ${text}`);
    },
    name: (label: string, description: string) => {
      ui.a11y_label(board, label);
      ui.a11y_description(board, description);
    },
  };
  vg.on_key(board, (k: string) => v.key(k));
  v.watch((s) => {
    if (s.boardSize === size) return;
    size = s.boardSize;
    vg.resize(board, size, size);
    print(`chess: the board is ${size} pixels`);
  });
}

/** The board scene at `px` pixels square; its handle. */
function scene(v: ChessView, px: number): number {
  const shown = () => v.shown.value;
  return vg.scene(`0 0 ${VIEW} ${VIEW}`, px, px, () => {
    vg.rect(0, 0, VIEW, VIEW, () => vg.bind_fill(() => paletteOf(shown()).frame));
    for (let r = 0; r < 8; ++r) {
      for (let c = 0; c < 8; ++c) {
        const x = MARGIN + c * SQUARE, y = MARGIN + r * SQUARE;
        const at = () => squareAt(c, r, shown().flipped);
        vg.rect(x, y, SQUARE, SQUARE, () => {
          vg.bind_fill(() => squareFill(shown(), at()));
          vg.on_click(() => v.clickSquare(at()));
        });
        // A legal target of the piece picked: a dot in the square.
        vg.circle(x + SQUARE / 2, y + SQUARE / 2, 1.6, () => {
          vg.bind_fill(() => paletteOf(shown()).target);
          vg.visible_when(() => shown().targets.includes(at()));
          vg.on_click(() => v.clickSquare(at()));
        });
        // The piece: a press picks it (or makes the move it is a target of);
        // dragged, it follows the pointer, and let go over a target, moves.
        const glyph: number = vg.text_anchored(x + SQUARE / 2, y + SQUARE * 0.82, 8.5, "middle", "", () => {
          vg.fill(COLOURS.piece);
          vg.bind_text(() => glyphOf(shown().pieces[at()] ?? ""));
          vg.cursor("grab");
          vg.on_click(() => v.clickSquare(at()));
          vg.on_drag((px: number, py: number) => {
            if (v.ownPiece(at())) vg.set_transform(glyph, `translate(${px - (x + SQUARE / 2)} ${py - (y + SQUARE / 2)})`);
          });
          vg.on_drag_end((px: number, py: number) => {
            vg.set_transform(glyph, "translate(0 0)");
            v.dropOn(at(), squareUnder(px, py, shown().flipped));
          });
        });
      }
    }
    // The keyboard's cursor: a frame round its square, once the keys have
    // moved it (four strips, so it scales with the board as a stroke would not).
    vg.g(() => {
      vg.bind_transform(() => {
        const at = shown().cursor;
        const c = at < 0 ? 0 : shown().flipped ? 7 - (at % 8) : at % 8;
        const r = at < 0 ? 0 : shown().flipped ? Math.floor(at / 8) : 7 - Math.floor(at / 8);
        return `translate(${c * SQUARE} ${r * SQUARE})`;
      });
      vg.visible_when(() => shown().cursor >= 0);
      const t = CURSOR_WIDTH;
      for (const [cx, cy, w, h] of [[0, 0, SQUARE, t], [0, SQUARE - t, SQUARE, t], [0, 0, t, SQUARE], [SQUARE - t, 0, t, SQUARE]]) {
        vg.rect(MARGIN + cx, MARGIN + cy, w, h, () => vg.bind_fill(() => paletteOf(shown()).cursor));
      }
    });
    // The files along the bottom and the ranks down the left, as the flip has them.
    for (let i = 0; i < 8; ++i) {
      vg.text_anchored(MARGIN + i * SQUARE + SQUARE / 2, VIEW - 0.8, 3, "middle", "", () => {
        vg.bind_fill(() => paletteOf(shown()).coordinate);
        vg.bind_text(() => FILE_CHARACTERS[shown().flipped ? 7 - i : i]);
      });
      vg.text_anchored(MARGIN / 2, MARGIN + i * SQUARE + SQUARE / 2 + 1, 3, "middle", "", () => {
        vg.bind_fill(() => paletteOf(shown()).coordinate);
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

