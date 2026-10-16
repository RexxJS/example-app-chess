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
  /** A pawn's move to the last rank, waiting for the piece it becomes; null when none is. */
  readonly promoting = state<{ from: number; to: number } | null>(null);
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

  // ---- moving on the board (board.ts calls these)

  /**
   * A click (a press) on a square: with nothing picked, it picks a piece of
   * the side to move, and its targets are shown; with a piece picked, a
   * target makes the move, another piece of the same side is picked
   * instead, the same square drops it, and any other square is refused.
   */
  clickSquare(index: number): void {
    if (this.promoting.value) return;
    const from = this.#selected;
    if (from >= 0 && from !== index && this.targetsOf(from).includes(index)) {
      this.moveTo(from, index);
      return;
    }
    if (from === index) {
      this.select(-1);
      return;
    }
    if (this.ownPiece(index)) {
      this.select(index);
      return;
    }
    if (from >= 0) {
      this.select(-1);
      this.status.set(`${getAlgebraicFromIndex(from)} to ${getAlgebraicFromIndex(index)} is not a legal move for ${this.cmds.game.turn()}`);
    }
  }

  /** A piece dragged from `from` and let go over `to` (-1: off the board). */
  dropOn(from: number, to: number): void {
    if (this.promoting.value || to < 0 || to === from || !this.ownPiece(from)) return;
    if (this.targetsOf(from).includes(to)) this.moveTo(from, to);
    else {
      this.select(-1);
      this.status.set(`${getAlgebraicFromIndex(from)} to ${getAlgebraicFromIndex(to)} is not a legal move for ${this.cmds.game.turn()}`);
    }
  }

  /** A piece of the side to move on the square. */
  ownPiece(index: number): boolean {
    const g = this.cmds.game;
    if (g.isOver()) return false;
    const letter = g.pieceAt(index);
    return letter !== "" && (letter === letter.toUpperCase()) === (g.turn() === "white");
  }

  /** The move from one square to another: made, or (a promotion) waiting for its piece. */
  moveTo(from: number, to: number): void {
    const sq = getAlgebraicFromIndex(from) + getAlgebraicFromIndex(to);
    const promotes = this.cmds.game.legalMoves().some((m) => m.getCoordinate().startsWith(sq) && m.isPromotion());
    if (promotes) {
      this.promoting.set({ from, to });
      this.refresh();
      this.status.set("promote to: queen, rook, bishop or knight");
      return;
    }
    this.run("game.move", { from: getAlgebraicFromIndex(from), to: getAlgebraicFromIndex(to) });
  }

  /** The piece a waiting promotion becomes ("queen", ...), or "" to take the move back. */
  promote(piece: string): void {
    const p = this.promoting.value;
    if (!p) return;
    this.promoting.set(null);
    if (!piece) {
      this.select(-1);
      this.status.set("no promotion: the pawn stays");
      return;
    }
    this.run("game.move", { from: getAlgebraicFromIndex(p.from), to: getAlgebraicFromIndex(p.to), promotion: piece });
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
