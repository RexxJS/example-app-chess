// The page's view of the game: the commands (commands.ts) and the states
// the panels read, as the spreadsheet's SheetView is. A panel shows what
// these states hold and runs commands through run(), and nothing else;
// after every command (a click, a button, a script, a control-bus request)
// refresh() puts the game into the states again, in one batch.
import { getIndexFromAlgebraic, getAlgebraicFromIndex } from "../chess.ts";
import { Commands } from "../commands.ts";
import type { Outcome, Params } from "../commands.ts";
import { stateOf } from "../game.ts";
import type { State } from "../game.ts";

/** What the board shows: a piece's FEN letter (or "") per square index 0-63, and the marks. */
export interface Shown {
  readonly pieces: readonly string[];
  readonly flipped: boolean;
  readonly lastFrom: number;        // -1 for none
  readonly lastTo: number;
  readonly check: number;           // the king in check's square, or -1
  readonly selected: number;        // the square picked to move from, or -1
  readonly targets: readonly number[];
}

export class ChessView {
  readonly cmds: Commands;
  readonly shown = state<Shown>({ pieces: [], flipped: false, lastFrom: -1, lastTo: -1, check: -1, selected: -1, targets: [] });
  readonly game = state<State | null>(null);
  readonly status = state("");          // what the last command said
  #selected = -1;

  constructor(cmds: Commands = new Commands()) {
    this.cmds = cmds;
  }

  /** Runs a command, says what it said, and shows the game again. */
  run(id: string, params: Params = {}): Outcome {
    const o = this.cmds.execute(id, params);
    this.#selected = -1;
    this.refresh();
    this.status.set(o.message);
    return o;
  }

  /** The square picked to move from (-1 for none): its legal targets are shown. */
  select(index: number): void {
    this.#selected = index;
    this.refresh();
  }

  selected(): number {
    return this.#selected;
  }

  /** The squares the piece on `from` may go to. */
  targetsOf(from: number): number[] {
    const sq = from >= 0 ? getAlgebraicFromIndex(from) : "";
    return this.cmds.game.legalMoves().filter((m) => m.getCoordinate().startsWith(sq)).map((m) => getIndexFromAlgebraic(m.getCoordinate().slice(2, 4)));
  }

  /** The game into the states, in one batch. */
  refresh(): void {
    const g = this.cmds.game;
    const s = stateOf(g);
    const pieces = Array.from({ length: 64 }, (_, i) => g.pieceAt(i));
    const last = s.lastMove;
    const king = s.check ? pieces.indexOf(s.turn === "white" ? "K" : "k") : -1;
    batch(() => {
      this.game.set(s);
      this.shown.set({
        pieces, flipped: s.flipped,
        lastFrom: last ? getIndexFromAlgebraic(last.slice(0, 2)) : -1, lastTo: last ? getIndexFromAlgebraic(last.slice(2, 4)) : -1,
        check: king, selected: this.#selected, targets: this.#selected >= 0 ? this.targetsOf(this.#selected) : [],
      });
    });
  }
}
