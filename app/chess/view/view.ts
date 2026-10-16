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
import { think } from "../think.ts";
import type { Thought } from "../think.ts";

/** What the board shows: a piece's FEN letter (or "") per square index 0-63, and the marks. */
export interface Shown {
  readonly pieces: readonly string[];
  readonly flipped: boolean;
  readonly lastFrom: number;        // -1 for none
  readonly lastTo: number;
  readonly check: number;           // the king in check's square, or -1
  readonly selected: number;        // the square picked to move from, or -1
  readonly targets: readonly number[];
  readonly dark: boolean;
}

export class ChessView {
  readonly cmds: Commands;
  readonly shown = state<Shown>({ pieces: [], flipped: false, lastFrom: -1, lastTo: -1, check: -1, selected: -1, targets: [], dark: false });
  readonly game = state<State | null>(null);
  readonly status = state("");          // what the last command said
  /** A pawn's move to the last rank, waiting for the piece it becomes; null when none is. */
  readonly promoting = state<{ from: number; to: number } | null>(null);
  /** What the computer is doing: "" when it is not thinking, else how far it has got. */
  readonly thinking = state("");
  #selected = -1;
  /** The computer's search in progress (think.ts), or null. */
  #thought: Thought | null = null;
  /** It thinks because it plays the side to move (not for Computer move). */
  #auto = false;
  /** The game's key when Stop was pressed: the computer does not start again by itself until the game changes. */
  #pausedKey = "";
  /** Told the game's state after every refresh: the panels that rebuild themselves (looks.ts, board.ts's size). */
  readonly #watchers: ((s: State) => void)[] = [];

  watch(fn: (s: State) => void): void {
    this.#watchers.push(fn);
  }

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

  // ---- the computer player (think.ts: in slices, the page live meanwhile)

  /** The computer plays the side to move (ai.side), and the game goes on. */
  computerToMove(): boolean {
    const g = this.cmds.game;
    return !g.isOver() && (g.aiSide === "both" || g.aiSide === g.turn());
  }

  isThinking(): boolean {
    return this.#thought !== null;
  }

  /** The computer thinks for the side to move, then makes its move (ai.move); `auto` when it does so because it plays that side. */
  think(auto = false): void {
    const g = this.cmds.game;
    if (this.#thought) return;
    if (g.isOver()) {
      this.status.set(`the game is over (${g.status()}, ${g.result()})`);
      return;
    }
    const who = `${g.turn()}, level ${g.aiLevel}`;
    const thought = think(g, (move, fresh, t) => {
      if (this.#thought !== thought) return;
      this.#thought = null;
      this.thinking.set("");
      if (!fresh) return;
      const o = this.run("ai.move", move === null ? {} : { move });
      if (o.ok && t.cut) this.status.set(`${o.message} (out of time at depth ${t.reached + 1}: depth ${t.reached}'s move)`);
    }, (t) => {
      const p = t.progress();
      this.thinking.set(`The computer (${who}) is thinking: depth ${p.depth} of ${t.depth}, move ${p.move} of ${p.of}`);
    });
    this.#thought = thought;
    this.#auto = auto;
    this.thinking.set(`The computer (${who}) is thinking`);
  }

  /** Stop: the search is dropped, and the computer waits until the game changes (or Computer move). */
  stopThinking(): void {
    if (!this.#thought) {
      this.status.set("the computer is not thinking");
      return;
    }
    this.#thought.cancel();
    this.#thought = null;
    this.#pausedKey = this.cmds.game.key();
    this.thinking.set("");
    this.status.set("stopped: the computer waits (Computer move to have it move)");
  }

  /** Undo, against the computer: back to the person's move (two moves, the computer's and theirs), when the computer plays one side. */
  undo(): void {
    const o = this.run("game.undo");
    if (o.ok && o.output && this.computerToMove() && this.cmds.game.aiSide !== "both" && this.cmds.game.canUndo()) this.run("game.undo");
  }

  // A search the game has left behind is dropped; the computer starts when
  // it plays the side to move, at the head of the game (not after an undo
  // or a step back in the move list, whose redo it would throw away), and
  // was not stopped at this position.
  #followGame(): void {
    const g = this.cmds.game;
    const t = this.#thought;
    if (t && (t.key !== g.key() || (this.#auto && !this.computerToMove()))) {
      t.cancel();
      this.#thought = null;
      this.thinking.set("");
    }
    if (!this.#thought && this.computerToMove() && !g.canRedo() && g.key() !== this.#pausedKey) this.think(true);
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
    if (this.promoting.value || this.#busy()) return;
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
    if (this.promoting.value || this.#busy() || to < 0 || to === from || !this.ownPiece(from)) return;
    if (this.targetsOf(from).includes(to)) this.moveTo(from, to);
    else {
      this.select(-1);
      this.status.set(`${getAlgebraicFromIndex(from)} to ${getAlgebraicFromIndex(to)} is not a legal move for ${this.cmds.game.turn()}`);
    }
  }

  // The computer is thinking: the board waits for it.
  #busy(): boolean {
    if (!this.#thought) return false;
    this.status.set("the computer is thinking (Stop to stop it)");
    return true;
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
        check: king, selected: this.#selected, targets: this.#selected >= 0 ? this.targetsOf(this.#selected) : [], dark: s.dark,
      });
    });
    for (const fn of this.#watchers) fn(s);
    this.#followGame();
  }
}
