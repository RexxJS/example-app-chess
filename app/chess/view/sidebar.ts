// Beside the board: the status in words (whose move, check, how the game
// ended and why), the pieces each side has taken and the material
// balance, and the move list: numbered, in SAN, the moves made and those
// ahead to redo, the current one marked "▸"; a click on a move goes to the
// position after it (game.goto: undo or redo to it), and "Start" to the
// beginning.
import { glyphOf } from "./board.ts";
import type { ChessView } from "./view.ts";

/** A move's label in the list: "1. e4", "1... e5"; the current marked. */
export function moveLabel(ply: number, san: string, current: boolean): string {
  const n = Math.ceil(ply / 2);
  return `${current ? "▸ " : ""}${n}${ply % 2 ? "." : "..."} ${san}`;
}

interface Row { readonly n: number; readonly white: string; readonly black: string; readonly key: string }

export function sidebar(v: ChessView): void {
  ui.vstack(() => {
    bind(ui.text(""), computed(() => v.game.value?.statusText ?? "", v.game));
    bind(ui.text(""), computed(() => {
      const g = v.game.value;
      return `White has taken: ${g && g.capturedByWhite.length ? g.capturedByWhite.map(glyphOf).join(" ") : "nothing"}`;
    }, v.game));
    bind(ui.text(""), computed(() => {
      const g = v.game.value;
      return `Black has taken: ${g && g.capturedByBlack.length ? g.capturedByBlack.map(glyphOf).join(" ") : "nothing"}`;
    }, v.game));
    bind(ui.text(""), computed(() => {
      const b = v.game.value?.balance ?? 0;
      return b === 0 ? "Material: even" : `Material: ${b > 0 ? "white" : "black"} +${Math.abs(b)}`;
    }, v.game));
    ui.btn("Start", () => v.run("game.goto", { ply: "0" }));
    // One row a full move: its number, white's move and black's, each a button.
    each(computed(() => {
      const g = v.game.value;
      if (!g) return [];
      const all = [...g.sans, ...g.future], at = g.sans.length, rows: Row[] = [];
      for (let ply = 1; ply <= all.length; ply += 2) {
        const white = moveLabel(ply, all[ply - 1], ply === at), black = ply < all.length ? moveLabel(ply + 1, all[ply], ply + 1 === at) : "";
        rows.push({ n: (ply + 1) / 2, white, black, key: `${ply}|${white}|${black}` });
      }
      return rows;
    }, v.game), (r: Row) => r.key, (r: Row) => ui.hstack(() => {
      ui.btn(r.white, () => v.run("game.goto", { ply: String(r.n * 2 - 1) }));
      if (r.black) ui.btn(r.black, () => v.run("game.goto", { ply: String(r.n * 2) }));
    }));
  });
}
