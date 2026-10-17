// The page's view of the game: the commands (commands.ts) and the states
// the panels read, as the spreadsheet's SheetView is. A panel shows what
// these states hold and runs commands through run(), and nothing else;
// after every command (a click, a button, a script, a control-bus request)
// refresh() puts the game into the states again, in one batch.
import { getIndexFromAlgebraic, getAlgebraicFromIndex } from "../chess.ts";
import { Commands } from "../commands.ts";
import type { Outcome, Params } from "../commands.ts";
import { BOARD_SIZES, stateOf } from "../game.ts";
import type { State } from "../game.ts";
import { hasNative, think, thinkNative } from "../think.ts";
import { bookMove } from "../book.ts";
import { timeText } from "../clock.ts";
import { puzzleLine } from "./puzzles.ts";
import type { ClockState } from "../clock.ts";

/** The clocks in a line: the running one marked "▸", a fallen flag said. */
export function clockLine(st: ClockState): string {
  const side = (s: "white" | "black") => `${st.running === s ? "▸ " : ""}${s} ${timeText(st[s])}${st.flag === s ? " (flag)" : ""}`;
  return `Clocks ${st.control}: ${side("white")} | ${side("black")}`;
}
import { analysisOf, lineText } from "../analysis.ts";
import { START_PIECES, fenOf } from "../setup.ts";
import type { Turn } from "../setup.ts";
import type { Thought } from "../think.ts";
import { boardText, moveText, squareText } from "../speak.ts";

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
  readonly cursor: number;          // the keyboard's cursor (view.cursor), or -1 while it is not shown
}

/** Where the board is told to a screen reader (board.ts gives sae's ui.a11y_*): a line said now, and the board's name and description. */
export interface Speaker {
  announce(text: string): void;
  name(label: string, description: string): void;
}

export class ChessView {
  readonly cmds: Commands;
  readonly shown = state<Shown>({ pieces: [], flipped: false, lastFrom: -1, lastTo: -1, check: -1, selected: -1, targets: [], dark: false, cursor: -1 });
  readonly game = state<State | null>(null);
  readonly status = state("");          // what the last command said
  /** A pawn's move to the last rank, waiting for the piece it becomes; null when none is. */
  readonly promoting = state<{ from: number; to: number } | null>(null);
  /** The position editor (setup.ts): the board being set up and the side to move, or null when not editing. */
  readonly editing = state<{ pieces: string[]; turn: Turn } | null>(null);
  /** The names of the games kept in the app (game.kept). */
  readonly kept = state<string[]>([]);
  /** The piece the editor puts on a square clicked (a FEN letter), "" for emptying it. */
  readonly brush = state("K");
  /** The puzzle under way, in a line (view/puzzles.ts); "" for none. */
  readonly puzzle = state("");
  /** The clocks as shown: "Clocks: ▸ white 4:57 | black 5:00", or "Clocks: none". */
  readonly clock = state("Clocks: none");
  /** What the computer is doing: "" when it is not thinking, else how far it has got. */
  readonly thinking = state("");
  /** The analysis line: the computer's value of the position and the line it expects, or a hint; "" for none. */
  readonly analysis = state("");
  #analysing: Thought | null = null;
  /** The game's key the analysis line is of ("" for none). */
  #analysedKey = "";
  #selected = -1;
  /** The computer's search in progress (think.ts), or null. */
  #thought: Thought | null = null;
  /** It thinks because it plays the side to move (not for Computer move). */
  #auto = false;
  /** The game's key when Stop was pressed: the computer does not start again by itself until the game changes. */
  #pausedKey = "";
  /** Told the game's state after every refresh: the panels that rebuild themselves (looks.ts, board.ts's size). */
  readonly #watchers: ((s: State) => void)[] = [];

  /** The board's screen reader (board.ts), or null with none (a headless test). */
  speaker: Speaker | null = null;
  /** What the speaker was last told: the game's key and ply, the cursor, the name and description. */
  #spoken = { key: "", ply: 0, cursor: -1, label: "", description: "" };

  watch(fn: (s: State) => void): void {
    this.#watchers.push(fn);
  }

  constructor(cmds: Commands = new Commands()) {
    this.cmds = cmds;
  }

  /** Runs a command, says what it said, and shows the game again. */
  run(id: string, params: Params = {}): Outcome {
    const o = this.cmds.execute(id, params);
    // The cursor moves with a piece picked: it is where the piece goes.
    if (id !== "view.cursor") this.#selected = -1;
    if (id === "view.boardSize") this.fitBoard();
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
    // A book move (book.ts) is made at once: nothing to think about.
    if (g.book && bookMove(g) !== null) {
      this.run("ai.move");
      return;
    }
    const who = `${g.turn()}, level ${g.aiLevel}`;
    // The engine in Aether when this sae has it (think.ts): one call, off the UI thread.
    if (hasNative()) {
      const native = thinkNative(g, (move, fresh) => {
        if (this.#thought !== native) return;
        this.#thought = null;
        this.thinking.set("");
        if (fresh) this.run("ai.move", move === null ? {} : { move });
      });
      this.#thought = native;
      this.#auto = auto;
      this.thinking.set(`The computer (${who}) is thinking, natively`);
      return;
    }
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

  // ---- analysis (analysis.ts), in slices as the computer's thinking is

  /** The position analysed at the computer's level: its value and the line it expects, on the analysis line; `hint`: only the move, its square picked. */
  analyse(hint = false): void {
    const g = this.cmds.game;
    if (g.isOver()) {
      this.analysis.set(`the game is over (${g.status()}, ${g.result()})`);
      return;
    }
    this.#analysing?.cancel();
    const level = g.aiLevel;
    const a = think(g, (_move, fresh, t) => {
      if (this.#analysing !== a) return;
      this.#analysing = null;
      if (!fresh) return;
      const r = analysisOf(g, t);
      if (hint) {
        this.analysis.set(r.best ? `Hint: ${r.best}` : "Hint: no move");
        if (r.coordinate && !this.#thought) this.select(getIndexFromAlgebraic(r.coordinate.slice(0, 2)));
      } else this.analysis.set(`Evaluation: ${r.text} at depth ${r.depth}: ${lineText(g, r.pv)}`);
    }, (t) => {
      const p = t.progress();
      this.analysis.set(`${hint ? "Finding a hint" : "Analysing"}: depth ${p.depth} of ${t.depth}, move ${p.move} of ${p.of}`);
    }, level);
    this.#analysing = a;
    this.#analysedKey = a.key;
    this.analysis.set(hint ? "Finding a hint" : "Analysing");
  }

  // ---- the board following the window (sae's ui.on_resize)

  /** How the page measures what is not the board: the sidebar's width and the height above the board (chess.ts gives it). */
  measure: () => { beside: number; above: number } = () => ({ beside: 0, above: 0 });
  #window: [number, number] = [0, 0];

  /** The window's content size, as sae tells it: the board fitted to it, when it follows the window. */
  windowSized(w: number, h: number): void {
    this.#window = [w, h];
    this.fitBoard();
  }

  /** The largest square there is room for: the window less the padding (16 px a side), the sidebar and what is above the board, 240 to 960 px. */
  fitSize(): number {
    const [w, h] = this.#window;
    const m = this.measure();
    const room = Math.min(w - 32 - m.beside - 24, h - 32 - m.above - 24);
    return Math.max(BOARD_SIZES.min, Math.min(BOARD_SIZES.max, Math.floor(room / 8) * 8));
  }

  /** When the board follows the window: its size from the room there is (not a command: the window, not the person, changed it). */
  fitBoard(): void {
    const g = this.cmds.game;
    if (!g.boardFit || this.#window[0] <= 0) return;
    const px = this.fitSize();
    if (px === g.boardSize) return;
    g.boardSize = px;
    this.refresh();
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
    if (!this.#thought && !this.editing.value && this.computerToMove() && !g.canRedo() && g.key() !== this.#pausedKey) this.think(true);
    // An analysis (or its line) of a position the game has left: dropped, and the line cleared.
    if (this.#analysedKey && this.#analysedKey !== g.key()) {
      this.#analysing?.cancel();
      this.#analysing = null;
      this.#analysedKey = "";
      this.analysis.set("");
    }
  }

  // ---- the position editor (TODO.md 5.2)

  /** Into the editor, from the position on the board now; any thinking stops. */
  editPosition(): void {
    if (this.#thought) this.stopThinking();
    const g = this.cmds.game;
    this.editing.set({ pieces: Array.from({ length: 64 }, (_, i) => g.pieceAt(i)), turn: g.turn() === "white" ? "w" : "b" });
    this.#selected = -1;
    this.refresh();
    this.status.set("setting up a position: pick a piece, click the squares, then Done");
  }

  /** One of the editor's buttons: Clear board, Start position, White to move, Black to move, Done, Cancel. */
  editAction(label: string): void {
    const e = this.editing.value;
    if (!e) return;
    if (label === "Cancel") {
      this.editing.set(null);
      this.refresh();
      this.status.set("set-up cancelled: the game as it was");
      return;
    }
    if (label === "Done") {
      const o = this.cmds.execute("game.setPosition", { fen: fenOf(e.pieces, e.turn) });
      if (o.ok) this.editing.set(null);
      this.refresh();
      this.status.set(o.ok ? o.message : `not a position yet: ${o.message}`);
      return;
    }
    if (label === "Clear board") this.editing.set({ ...e, pieces: new Array(64).fill("") });
    else if (label === "Start position") this.editing.set({ pieces: [...START_PIECES], turn: "w" });
    else if (label === "White to move" || label === "Black to move") this.editing.set({ ...e, turn: label === "White to move" ? "w" : "b" });
    this.refresh();
  }

  // A square clicked in the editor: the brush's piece put there (or taken off, when it is there already).
  #put(index: number): void {
    const e = this.editing.value!;
    const pieces = [...e.pieces];
    pieces[index] = pieces[index] === this.brush.value ? "" : this.brush.value;
    this.editing.set({ ...e, pieces });
    this.refresh();
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
    if (this.editing.value) {
      this.#put(index);
      return;
    }
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
    if (this.editing.value || this.promoting.value || this.#busy() || to < 0 || to === from || !this.ownPiece(from)) return;
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

  // ---- the board from the keyboard (TODO.md 6.6): board.ts hears the keys

  #say(text: string): void {
    if (text) this.speaker?.announce(text);
  }

  #pieces(): string[] {
    const e = this.editing.value;
    return e ? e.pieces : Array.from({ length: 64 }, (_, i) => this.cmds.game.pieceAt(i));
  }

  /**
   * A key on the board: the arrows move the cursor across the board as it
   * is shown (view.cursor, the square said); Return or Space picks the
   * piece under it (its targets said) and, on a target, makes the move
   * (said as it is made); Escape puts a piece picked back. While a
   * promotion waits, q, r, b or n is its piece and Escape keeps the pawn.
   */
  key(k: string): void {
    const step = ({ Left: "left", Right: "right", Up: "up", Down: "down" } as Record<string, string>)[k];
    if (this.promoting.value) {
      const piece = ({ q: "queen", r: "rook", b: "bishop", n: "knight" } as Record<string, string>)[k.toLowerCase()];
      if (piece) this.promote(piece);
      else if (k === "Escape") {
        this.promote("");
        this.#say("no promotion: the pawn stays");
      } else this.#say("promote to: q queen, r rook, b bishop or n knight");
      return;
    }
    if (step) {
      this.run("view.cursor", { by: step });
      return;
    }
    if (k === "Return" || k === "KP_Enter" || k === "space") {
      this.pressCursor();
      return;
    }
    if (k === "Escape") {
      const from = this.#selected;
      if (from < 0) return;
      this.select(-1);
      this.#say(`${getAlgebraicFromIndex(from)} put back`);
    }
  }

  /** Return or Space on the board: the square under the cursor clicked, and what came of it said. */
  pressCursor(): void {
    const g = this.cmds.game;
    if (!g.cursorShown) this.run("view.cursor");
    const at = g.cursor, from = this.#selected, ply = g.made.length;
    this.clickSquare(at);
    if (this.editing.value) {
      this.#say(squareText(this.editing.value.pieces, at));
      return;
    }
    // A move made is said as the game shows it (refresh); a promotion waits for its piece.
    if (this.promoting.value) {
      this.#say("promote to: q queen, r rook, b bishop or n knight");
      return;
    }
    if (g.made.length !== ply) return;
    if (this.#selected === at && from !== at) {
      const to = [...new Set(this.targetsOf(at).map(getAlgebraicFromIndex))].sort();
      this.#say(`${squareText(this.#pieces(), at)}, picked: ${to.length ? `to ${to.join(", ")}` : "it has no move"}`);
    } else if (from === at) this.#say(`${getAlgebraicFromIndex(at)} put back`);
    else if (from >= 0 || this.#thought) this.#say(this.status.value);
    else this.#say(`${squareText(this.#pieces(), at)}: no ${g.turn()} piece to move`);
  }

  // What changed, told the speaker: a move made ("e2 to e4"), else the game
  // somewhere else (an undo, a new game: its status), else the cursor's
  // square; and the board's name and description when they differ.
  #speak(s: State, pieces: readonly string[], before: readonly string[]): void {
    const sp = this.speaker;
    if (!sp) return;
    const g = this.cmds.game;
    const key = g.key(), ply = s.sans.length, editing = this.editing.value !== null;
    const was = this.#spoken;
    let say = "";
    if (was.key && key !== was.key && !editing) {
      if (ply === was.ply + 1 && s.lastMove && before.length === 64) {
        say = moveText(before, s.lastMove, s.sans[ply - 1]);
        if (g.isOver() && !s.sans[ply - 1].endsWith("#")) say = `${say}; ${s.statusText}`;
      } else say = s.statusText;
    } else if (s.cursor >= 0 && s.cursor !== was.cursor) say = squareText(pieces, s.cursor);
    const label = `Chess board, ${editing ? "being set up" : s.statusText}`;
    const description = `${s.cursor >= 0 ? `Cursor on ${squareText(pieces, s.cursor)}. ` : ""}${boardText(pieces)}`;
    if (label !== was.label || description !== was.description) sp.name(label, description);
    this.#spoken = { key, ply, cursor: s.cursor, label, description };
    if (say) sp.announce(say);
  }

  // ---- the clocks (clock.ts)

  /** The clocks charged to now (the page's timer, a few times a second): shown, and the game ended when a flag falls. */
  tickClock(): void {
    if (!this.cmds.clock) return;
    const over = this.cmds.game.isOver();
    this.cmds.tick();
    if (!over && this.cmds.game.isOver()) {
      this.refresh();
      this.status.set(this.cmds.game.statusText());
    } else this.clock.set(clockLine(this.cmds.clock.state()));
  }

  /** The game into the states, in one batch. */
  refresh(): void {
    const g = this.cmds.game;
    const s = stateOf(g);
    const editing = this.editing.value;
    const pieces = editing ? editing.pieces : Array.from({ length: 64 }, (_, i) => g.pieceAt(i));
    const last = editing ? null : s.lastMove;
    const king = s.check && !editing ? pieces.indexOf(s.turn === "white" ? "K" : "k") : -1;
    const kept = this.cmds.execute("game.kept").output as string[];
    const clock = this.cmds.clock ? clockLine(this.cmds.clock.state()) : "Clocks: none";
    const puzzle = puzzleLine(this.cmds.puzzles.state());
    const before = this.shown.value.pieces;
    batch(() => {
      if (this.puzzle.value !== puzzle) this.puzzle.set(puzzle);
      if (this.clock.value !== clock) this.clock.set(clock);
      if (kept.join("\n") !== this.kept.value.join("\n")) this.kept.set(kept);
      this.game.set(s);
      this.shown.set({
        pieces, flipped: s.flipped,
        lastFrom: last ? getIndexFromAlgebraic(last.slice(0, 2)) : -1, lastTo: last ? getIndexFromAlgebraic(last.slice(2, 4)) : -1,
        check: king, selected: this.#selected, targets: this.#selected >= 0 ? this.targetsOf(this.#selected) : [], dark: s.dark,
        cursor: s.cursor,
      });
    });
    this.#speak(s, pieces, before);
    for (const fn of this.#watchers) fn(s);
    this.cmds.autosave();
    this.#followGame();
  }
}
