// The promotion choice: a pawn moved to the last rank on the board waits
// here for the piece it becomes (ChessView.promoting), one button each,
// and a Cancel that leaves the pawn where it was.
import type { ChessView } from "./view.ts";

const PIECES = ["queen", "rook", "bishop", "knight"];

export function promotionBar(v: ChessView): void {
  ui.hstack(() => {
    each(computed(() => (v.promoting.value ? [...PIECES, ""] : []), v.promoting), (p: string) => p || "cancel", (p: string) =>
      ui.btn(p ? `Promote to ${p}` : "Cancel promotion", () => v.promote(p)));
  });
}
