// Below the board: Chess960 (a new game from one of its start positions,
// at random: TODO.md 6.5), and the puzzles (puzzle.ts, TODO.md 6.4): the puzzle under
// way, its goal and how it stands; Puzzle (the next of the set), Open
// puzzles (a set from a file the person picks, through documents).
import type { ChessView } from "./view.ts";
import type { PuzzleState } from "../puzzle.ts";

/** The line about the puzzle: which, its goal, then solved, failed and why, or the moves left. */
export function puzzleLine(st: PuzzleState | null): string {
  if (!st) return "";
  const head = `Puzzle ${st.index} of ${st.count}, ${st.title}: ${st.solver} to play and ${st.goal}`;
  if (st.state === "solved") return `${head}. Solved!`;
  if (st.state === "failed") return `${head}. Not solved: ${st.why} (Undo to try again)`;
  return `${head}. ${st.left} ${st.left === 1 ? "move" : "moves"} left`;
}

export function puzzlePanel(v: ChessView): void {
  ui.hstack(() => {
    // A Chess960 game (chess960.ts), its start position at random.
    ui.btn("Chess960", () => v.run("game.new960"));
    ui.btn("Puzzle", () => {
      const st = v.cmds.puzzles.state();
      const next = st ? (st.index % v.cmds.puzzles.set.length) + 1 : 1;
      v.run("puzzle.load", { n: String(next) });
    });
    if (typeof documents !== "undefined") {
      ui.btn("Open puzzles", async () => {
        try {
          const d = await documents.pick_open("Open a set of puzzles");
          if (!d) return;
          const o = v.run("puzzle.import", { text: await d.read_text() });
          if (o.ok) v.run("puzzle.load", { n: "1" });
        } catch (e) {
          v.status.set(String((e as Error)?.message ?? e));
        }
      });
    }
    bind(ui.text(""), v.puzzle);
  });
}
