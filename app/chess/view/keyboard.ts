// Moves from the keyboard: a field to type a move in, coordinate notation
// ("e2e4", "e7e8q") or SAN ("Nf3", "O-O", "exd5"), made on Return as any
// move is (game.move); the field is emptied when it is made, and a move
// that is not legal is refused and said, the text left to correct.
import type { ChessView } from "./view.ts";

export const PLACEHOLDER = "Type a move: e2e4 or Nf3";

export function moveField(v: ChessView): void {
  const typed = state("");
  ui.hstack(() => {
    ui.on_submit(bind(ui.textfield(PLACEHOLDER, () => {}), typed), () => {
      const text = typed.value.trim();
      if (!text) return;
      const o = v.run("game.move", { san: text });
      if (o.ok) typed.set("");
    });
  });
}
