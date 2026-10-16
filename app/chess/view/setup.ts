// Setting a position up (TODO.md 5.2): a FEN typed or pasted into a field
// and set (game.setPosition, SETPOSITION in REXX); or the position editor:
// Edit position puts the board in set-up, a piece picked from the palette
// (or Empty) and put on the squares clicked, the board cleared or the
// start put back, the side to move chosen, and Done sets the game to it
// (castling rights where king and rook stand at home); Cancel leaves the
// game as it was. The editor's board is the view's (ChessView.editing,
// shown on the board as the game is), its FEN app/chess/setup.ts's.
import { glyphOf } from "./board.ts";
import type { ChessView } from "./view.ts";

export const FEN_PLACEHOLDER = "Paste a position (FEN)";
const PALETTE = ["K", "Q", "R", "B", "N", "P", "k", "q", "r", "b", "n", "p"];

export function setupPanel(v: ChessView): void {
  const typed = state("");
  ui.hstack(() => {
    ui.on_submit(bind(ui.textfield(FEN_PLACEHOLDER, () => {}), typed), () => setTyped(v, typed));
    ui.btn("Set position", () => setTyped(v, typed));
    ui.btn("Edit position", () => v.editPosition());
  });
  // The palette and the editor's buttons, there while editing.
  ui.hstack(() => {
    each(computed(() => (v.editing.value ? [...PALETTE, ""] : []), v.editing), (p: string) => p || "empty",
      (p: string) => ui.btn(p ? `Put ${glyphOf(p)}` : "Put empty", () => v.brush.set(p)));
  });
  ui.hstack(() => {
    each(computed(() => (v.editing.value ? ["Clear board", "Start position", "White to move", "Black to move", "Done", "Cancel"] : []), v.editing), (l: string) => l,
      (l: string) => ui.btn(l, () => v.editAction(l)));
  });
  bind(ui.text(""), computed(() => {
    const e = v.editing.value;
    if (!e) return "";
    const b = v.brush.value;
    return `Setting up: ${e.turn === "w" ? "white" : "black"} to move; putting ${b ? glyphOf(b) : "empty"}`;
  }, v.editing, v.brush));
}

function setTyped(v: ChessView, typed: { value: string; set(v: string): void }): void {
  const fen = typed.value.trim();
  if (!fen) return;
  const o = v.run("game.setPosition", { fen });
  if (o.ok) typed.set("");
}
