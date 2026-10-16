// The analysis line: Analyse (the computer's value of the position and
// the line it expects, at its level) and Hint (the move it would play, its
// square picked on the board), each thought in slices (think.ts), the page
// live meanwhile; the line goes when the game moves on.
import type { ChessView } from "./view.ts";

export function analysisPanel(v: ChessView): void {
  ui.hstack(() => {
    ui.btn("Analyse", () => v.analyse());
    ui.btn("Hint", () => v.analyse(true));
    bind(ui.text(""), v.analysis);
  });
}
