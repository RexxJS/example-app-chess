// game.ts: a game over a position (position.ts): the moves made and their
// SAN, undo and redo in steps (a step is one move, or the moves one
// control-bus request made, folded so one Undo takes them all back), a
// new game, a position set from FEN (the game then starts there), whose
// turn, the result (resigned, a draw agreed, or the position's own), and
// the settings the commands keep (the computer player's level and side,
// the board flipped). The old app (src/ui.js) had undo but never redo; it
// is here. A snapshot (saved/restore) puts a game back whole, for a
// request that failed part way. No ui, and no engine code of its own:
// Kaj Björklund's position does the chess.
import { PieceColor } from "./chess.ts";
import type { PieceColor as Color } from "./chess.ts";
import { Move } from "./move.ts";
import { Position, Status } from "./position.ts";
import { START_FEN, fromFen, parseMove, toFen, toSan } from "./parser.ts";
import { parsePgn, toPgn } from "./pgn.ts";
import type { PgnKept } from "./pgn.ts";
import { openingOf } from "./book.ts";
import { fen960, number960 } from "./chess960.ts";

export type Side = "white" | "black";
export type AiSide = "white" | "black" | "both" | "none";

/** The board's sizes on the page, in pixels: the smallest, the largest, and a step of Smaller or Larger. */
export const BOARD_SIZES = { min: 240, max: 960, step: 80 } as const;

/** The levels the computer player plays at (ai.ts): depth 1 to 4 half-moves. */
export const LEVELS = [1, 2, 3, 4];

/** What a game is at, in words: the position's status, or how it ended. */
export type GameStatus = "in_progress" | "check" | "checkmate" | "stalemate" | "fifty_move_draw" | "threefold_repetition_draw" | "insufficient_material_draw" | "resigned" | "draw_agreed" | "time_forfeit";

const STATUS_WORDS: Record<number, GameStatus> = {
  [Status.NORMAL]: "in_progress",
  [Status.CHECK]: "check",
  [Status.CHECKMATE]: "checkmate",
  [Status.STALEMATE_DRAW]: "stalemate",
  [Status.FIFTY_MOVE_RULE_DRAW]: "fifty_move_draw",
  [Status.THREEFOLD_REPETITION_RULE_DRAW]: "threefold_repetition_draw",
  [Status.INSUFFICIENT_MATERIAL_DRAW]: "insufficient_material_draw",
};

/** A move made in the game, with the SAN it had when made. */
export interface Made {
  readonly move: Move;
  readonly san: string;
}

/** The game file's format name. */
export const GAME_FORMAT = "sae-chess-game";

/** A game as its file has it (Game.toFile). */
export interface GameFile {
  readonly format: string;
  readonly version: number;
  readonly start: string;
  readonly moves: readonly string[];
  readonly resigned?: Side;
  readonly drawAgreed?: boolean;
  readonly flagged?: Side;
  readonly aiLevel: number;
  readonly aiSide: AiSide;
  readonly flipped: boolean;
  readonly book?: boolean;
}

/** A game put away whole: enough to restore it (saved/restore). */
export interface Snapshot {
  readonly startFen: string;
  readonly moves: readonly string[];        // coordinate notation, in order
  readonly steps: readonly number[];        // how many moves each undo step holds
  readonly redo: readonly (readonly string[])[];   // each redo step's moves, newest last
  readonly resigned: Side | null;
  readonly drawAgreed: boolean;
  readonly aiLevel: number;
  readonly aiSide: AiSide;
  readonly flipped: boolean;
  readonly dark?: boolean;
  readonly boardSize?: number;
  readonly boardFit?: boolean;
  readonly pgn?: PgnKept | null;
  readonly book?: boolean;
  readonly flagged?: Side;
}

export class Game {
  position: Position;
  /** The FEN the game started from (START_FEN for a new game). */
  startFen: string;
  /** The moves made, oldest first, with their SAN. */
  made: Made[] = [];
  /** Undo steps: each the count of moves it took (the newest last); their sum is made.length. */
  steps: number[] = [];
  /** Redo steps: each the moves (with SAN) it puts back, the next to redo last. */
  redoSteps: Made[][] = [];
  resigned: Side | null = null;
  drawAgreed = false;
  /** The side whose flag fell (clock.ts): the game is over on time; an undo does not bring the time back. */
  flagged: Side | null = null;
  aiLevel = 2;
  aiSide: AiSide = "none";
  flipped = false;
  /** The computer plays from the opening book (book.ts) while the game is in it (ai.book). */
  book = false;
  /** The page's dark look (view.dark); not part of a game file. */
  dark = false;
  /** The board's size on the page, in pixels (view.boardSize); not part of a game file. */
  boardSize = 480;
  /** The board follows the window (the page sizes it to fit, view.boardSize fit=1); a size set by hand stops it. Not part of a game file. */
  boardFit = true;
  /** The keyboard's cursor on the board (view.cursor), a square 0-63; not part of a game file. */
  cursor = 12;
  /** The cursor is shown: once the keyboard (or view.cursor) has moved it. Not part of a game file. */
  cursorShown = false;
  /** What a game read from PGN keeps besides its moves (its tags, comments, variations), to write again; null for a game not read so. */
  pgn: PgnKept | null = null;
  /** Set while a group is open: the step the moves made since fold into (its index in `steps`), or -1 before its first move. */
  #group: number | null = null;

  constructor(fen: string = START_FEN) {
    this.position = fromFen(fen);
    this.startFen = fen;
  }

  // ---- whose turn, the result

  turn(): Side {
    return this.position.getTurnColor() === PieceColor.WHITE ? "white" : "black";
  }

  /** "in_progress", "check", "checkmate", ..., "resigned", "draw_agreed". */
  status(): GameStatus {
    if (this.resigned) return "resigned";
    if (this.drawAgreed) return "draw_agreed";
    if (this.flagged) return "time_forfeit";
    return STATUS_WORDS[this.position.getStatus()];
  }

  /** The game's result as PGN has it: "1-0", "0-1", "1/2-1/2", or "*" while it goes on. */
  result(): string {
    if (this.resigned) return this.resigned === "white" ? "0-1" : "1-0";
    if (this.drawAgreed) return "1/2-1/2";
    if (this.flagged) {
      const other: Side = this.flagged === "white" ? "black" : "white";
      return !this.canMate(other) ? "1/2-1/2" : other === "white" ? "1-0" : "0-1";
    }
    const s = this.position.getStatus();
    if (s === Status.CHECKMATE) return this.turn() === "white" ? "0-1" : "1-0";
    if (s === Status.STALEMATE_DRAW || s === Status.FIFTY_MOVE_RULE_DRAW || s === Status.THREEFOLD_REPETITION_RULE_DRAW || s === Status.INSUFFICIENT_MATERIAL_DRAW) return "1/2-1/2";
    return "*";
  }

  /** Over by mate, a draw, resignation or agreement: no more moves. */
  isOver(): boolean {
    return this.result() !== "*";
  }

  /** The legal moves now (none once the game is over). */
  legalMoves(): Move[] {
    return this.isOver() ? [] : this.position.getMoves();
  }

  // ---- moves, undo, redo

  /** The legal move `text` names (coordinate "e2e4", "e7e8q", or SAN "Nf3", "O-O"), or null. */
  find(text: string): Move | null {
    return this.isOver() ? null : parseMove(this.position, text);
  }

  /** Makes a legal move: a new step of undo (or part of the open group's), and nothing to redo. */
  move(move: Move): Made {
    const san = toSan(this.position, move);
    if (!this.position.makeMove(move)) throw new Error(`${move.getCoordinate()} leaves the king in check`);
    const made = { move, san };
    this.made.push(made);
    if (this.#group !== null && this.#group >= 0) this.steps[this.#group]++;
    else {
      this.steps.push(1);
      if (this.#group !== null) this.#group = this.steps.length - 1;
    }
    this.redoSteps = [];
    return made;
  }

  canUndo(): boolean {
    return this.steps.length > 0;
  }

  canRedo(): boolean {
    return this.redoSteps.length > 0;
  }

  /** Takes the last step back: the moves it held, oldest first; null when there is none. */
  undo(): Made[] | null {
    if (!this.steps.length) return null;
    const n = this.steps.pop()!;
    const taken = this.made.splice(this.made.length - n, n);
    for (let i = 0; i < n; ++i) this.position.unmakeMove();
    this.redoSteps.push(taken);
    // A result reached by resigning or agreeing stands only on the position it was reached in.
    this.resigned = null;
    this.drawAgreed = false;
    return taken;
  }

  /** Does the last step taken back again: its moves; null when there is none. */
  redo(): Made[] | null {
    const step = this.redoSteps.pop();
    if (!step) return null;
    for (const m of step) {
      if (!this.position.makeMove(m.move)) throw new Error(`redo: ${m.move.getCoordinate()} is not legal here`);
      this.made.push(m);
    }
    this.steps.push(step.length);
    return step;
  }

  // ---- a group: the moves of one request as one step

  /** From here until endGroup, every move folds into one step of undo. */
  beginGroup(): void {
    this.#group = -1;
  }

  /** Closes the group; true when it made a step. */
  endGroup(): boolean {
    const stepped = this.#group !== null && this.#group >= 0;
    this.#group = null;
    return stepped;
  }

  // ---- a new game, a position

  /** The start position, nothing to undo or redo; the settings stay. */
  newGame(): void {
    this.setPosition(START_FEN);
  }

  /** A new Chess960 game (chess960.ts): start position n, 0 to 959 (518 is the usual one). */
  newGame960(n: number): void {
    this.setPosition(fen960(n));
  }

  /** The Chess960 number of the position the game started from, or -1 when it is none of them. */
  chess960(): number {
    return number960(this.startFen);
  }

  /** The game starts again from `fen` (which must be a position: fromFen says what is wrong with one that is not). */
  setPosition(fen: string): void {
    const position = fromFen(fen);
    this.position = position;
    this.startFen = toFen(position);
    this.made = [];
    this.steps = [];
    this.redoSteps = [];
    this.resigned = null;
    this.drawAgreed = false;
    this.flagged = null;
    this.pgn = null;
    if (this.#group !== null) this.#group = -1;
  }

  /** The side to move resigns (or `side`); the game is over. */
  resign(side: Side = this.turn()): void {
    if (this.isOver()) throw new Error("the game is over");
    this.resigned = side;
  }

  /** A side's flag fell (clock.ts): it loses on time, or draws when the other cannot mate. */
  flagFall(side: Side): void {
    if (this.isOver()) return;
    this.flagged = side;
  }

  /** Whether `side` has the pieces to mate at all: more than a king, or a king and one knight or bishop. */
  canMate(side: Side): boolean {
    const own = side === "white" ? PieceColor.WHITE : PieceColor.BLACK;
    let minors = 0;
    for (let i = 0; i < 64; ++i) {
      if (this.position.getColorAtOrNull(i) !== own) continue;
      const piece = this.position.getPieceAtOrNull(i)!;
      if (piece === 5) continue;
      if (piece === 1 || piece === 2) minors++;
      else return true;
    }
    return minors > 1;
  }

  /** A draw by agreement; the game is over. */
  agreeDraw(): void {
    if (this.isOver()) throw new Error("the game is over");
    this.drawAgreed = true;
  }

  // ---- going to a move (the move list's clicks)

  /** The moves that redo would make, in the order it would make them. */
  future(): Made[] {
    return [...this.redoSteps].reverse().flat();
  }

  /**
   * Undo or redo whole steps until `ply` moves are made (0: the start); a
   * step of several moves (one request's) is not split, so it lands on the
   * last step's end at or before `ply`. The moves made after it.
   */
  goto(ply: number): number {
    while (this.made.length > ply && this.undo());
    while (this.redoSteps.length && this.made.length + this.redoSteps[this.redoSteps.length - 1].length <= ply) this.redo();
    return this.made.length;
  }

  // ---- what the side panel shows

  /** The status in words: whose move, check, or how the game ended and why. */
  statusText(): string {
    const winner = (side: Side) => `${side === "white" ? "white" : "black"} wins`;
    const other: Side = this.turn() === "white" ? "black" : "white";
    switch (this.status()) {
      case "resigned": return `${this.resigned} resigned: ${winner(this.resigned === "white" ? "black" : "white")} (${this.result()})`;
      case "draw_agreed": return "a draw, agreed (1/2-1/2)";
      case "time_forfeit": {
        const other: Side = this.flagged === "white" ? "black" : "white";
        return this.result() === "1/2-1/2" ? `${this.flagged}'s flag fell, but ${other} cannot mate: a draw (1/2-1/2)` : `${this.flagged}'s flag fell: ${winner(other)} on time (${this.result()})`;
      }
      case "checkmate": return `checkmate: ${winner(other)} (${this.result()})`;
      case "stalemate": return `stalemate: ${this.turn()} has no move, a draw (1/2-1/2)`;
      case "fifty_move_draw": return "a draw by the fifty-move rule: fifty moves each with no capture or pawn move (1/2-1/2)";
      case "threefold_repetition_draw": return "a draw by threefold repetition: the same position a third time (1/2-1/2)";
      case "insufficient_material_draw": return "a draw: neither side has the pieces to mate (1/2-1/2)";
      case "check": return `${this.turn()} to move, in check`;
      default: return `${this.turn()} to move`;
    }
  }

  /**
   * The pieces taken: what each side's opponent has lost since the start
   * position (FEN letters, the most valuable first), and the material
   * balance (pawn 1, knight and bishop 3, rook 5, queen 9; above 0 is
   * white ahead). A promoted pawn counts as the piece it became.
   */
  captured(): { byWhite: string[]; byBlack: string[]; balance: number } {
    const count = (p: Position) => {
      const n: Record<string, number> = {};
      for (let i = 0; i < 64; ++i) {
        const piece = p.getPieceAtOrNull(i);
        if (piece === null) continue;
        const letter = "PNBRQK".charAt(piece);
        const key = p.getColorAtOrNull(i) === PieceColor.WHITE ? letter : letter.toLowerCase();
        n[key] = (n[key] ?? 0) + 1;
      }
      return n;
    };
    const was = count(fromFen(this.startFen)), now = count(this.position);
    const lost = (letters: string) => letters.split("").flatMap((l) => Array(Math.max(0, (was[l] ?? 0) - (now[l] ?? 0))).fill(l));
    const value: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
    let balance = 0;
    for (const [l, n] of Object.entries(now)) balance += (l === l.toUpperCase() ? 1 : -1) * value[l.toUpperCase()] * n;
    return { byWhite: lost("qrbnp"), byBlack: lost("QRBNP"), balance };
  }

  // ---- reading

  /** A position of its own with this game's history, for a search to work on: the start, then each move made. */
  positionCopy(): Position {
    const p = fromFen(this.startFen);
    for (const m of this.made) p.makeMove(m.move);
    return p;
  }

  /** What changes when the game does (a move, undo, a new position, the end): a search started at one key is stale at another. */
  key(): string {
    return `${this.fen()} ${this.made.length} ${this.status()}`;
  }

  fen(): string {
    return toFen(this.position);
  }

  /** The moves made, in coordinate notation. */
  moveList(): string[] {
    return this.made.map((m) => m.move.getCoordinate());
  }

  /** The moves made, in SAN. */
  sanList(): string[] {
    return this.made.map((m) => m.san);
  }

  /** The piece on a square, as FEN letters it (K, q, ...), or "" for none; `square` is "e4". */
  pieceAt(index: number): string {
    const piece = this.position.getPieceAtOrNull(index);
    if (piece === null) return "";
    const letter = "PNBRQK".charAt(piece);
    return this.position.getColorAtOrNull(index) === PieceColor.WHITE ? letter : letter.toLowerCase();
  }

  colorAt(index: number): Color | null {
    return this.position.getColorAtOrNull(index);
  }

  // ---- the game as a program (the script panel's recorder)

  /**
   * The game as a REXX program that plays it again: a new game (or the
   * position it started from), then a MOVE line a move, in the control
   * functions' own terms, with the SAN as a comment. A game is a program:
   * run it in the script panel, over the bus or in RexxJS's CLI
   * (ADDRESS CHESS), and the same position comes out.
   */
  toScript(): string {
    const lines = ["/* A game, recorded by the chess app: run it to play it again */"];
    lines.push(this.startFen === START_FEN ? "r = NEWGAME()" : `r = SETPOSITION("${this.startFen}")`);
    const pieceName: Record<string, string> = { q: "queen", r: "rook", b: "bishop", n: "knight" };
    this.made.forEach((m, i) => {
      const c = m.move.getCoordinate(), ply = i + 1;
      const promotion = c.length > 4 ? `, "${pieceName[c[4]]}"` : "";
      lines.push(`r = MOVE("${c.slice(0, 2)}", "${c.slice(2, 4)}"${promotion})   /* ${Math.ceil(ply / 2)}${ply % 2 ? "." : "..."} ${m.san} */`);
    });
    if (this.resigned) lines.push(`r = RESIGN("${this.resigned}")`);
    else if (this.drawAgreed) lines.push("r = OFFERDRAW()");
    return lines.join("\n") + "\n";
  }

  // ---- the game as a file

  /**
   * The game as its file's JSON: where it started, its moves (coordinate
   * notation), its result when it was ended by resigning or agreement, who
   * the computer plays, its level and the flip. Its undo steps are not
   * kept: an opened game undoes a move at a time.
   */
  toFile(): GameFile {
    return {
      format: GAME_FORMAT, version: 1, start: this.startFen, moves: this.moveList(),
      ...(this.resigned ? { resigned: this.resigned } : {}), ...(this.drawAgreed ? { drawAgreed: true } : {}),
      ...(this.flagged ? { flagged: this.flagged } : {}),
      aiLevel: this.aiLevel, aiSide: this.aiSide, flipped: this.flipped, ...(this.book ? { book: true } : {}),
    };
  }

  /** The game a file holds, in place of this one; throws saying what is wrong with it, and then this game is as it was. */
  fromFile(text: string): void {
    let f: Partial<GameFile>;
    try {
      f = JSON.parse(text) as Partial<GameFile>;
    } catch (e) {
      throw new Error(`a game file is JSON: ${(e as Error).message}`);
    }
    if (!f || typeof f !== "object" || f.format !== GAME_FORMAT) throw new Error(`a game file says "format": "${GAME_FORMAT}"`);
    if (f.version !== 1) throw new Error(`a game file of version ${f.version} is not one this app reads (1)`);
    const g = new Game(typeof f.start === "string" ? f.start : START_FEN);
    for (const [i, text] of (Array.isArray(f.moves) ? f.moves : []).entries()) {
      const move = g.find(String(text));
      if (!move) throw new Error(`the game file's move ${i + 1}, ${text}, is not legal there`);
      g.move(move);
    }
    if (f.resigned === "white" || f.resigned === "black") g.resign(f.resigned);
    else if (f.drawAgreed === true) g.agreeDraw();
    else if (f.flagged === "white" || f.flagged === "black") g.flagFall(f.flagged);
    if (LEVELS.includes(Number(f.aiLevel))) g.aiLevel = Number(f.aiLevel);
    if (f.aiSide === "white" || f.aiSide === "black" || f.aiSide === "both" || f.aiSide === "none") g.aiSide = f.aiSide;
    g.flipped = f.flipped === true;
    g.book = f.book === true;
    g.dark = this.dark;
    g.boardSize = this.boardSize;
    g.boardFit = this.boardFit;
    this.restore(g.saved());
    // Read in: nothing to redo, nothing to undo past its own moves.
    this.redoSteps = [];
  }

  // ---- the game as PGN (pgn.ts)

  /** The game as PGN, its kept tags and notes with it. */
  toPgn(date?: string): string {
    return toPgn(this, date);
  }

  /**
   * The first game of a PGN text, in place of this one: its moves played
   * from its start, its result (a decisive or drawn one the moves did not
   * reach is a resignation or an agreed draw), what it kept. Throws saying
   * what is wrong, and then this game is as it was.
   */
  fromPgn(text: string): void {
    const p = parsePgn(text);
    let g: Game;
    try {
      g = new Game(p.start);
    } catch (e) {
      throw new Error(`PGN: its FEN: ${(e as Error).message}`);
    }
    for (const [i, san] of p.moves.entries()) {
      const move = g.find(san);
      if (!move) throw new Error(`PGN: move ${Math.floor(i / 2) + 1}${(i % 2) ? "..." : "."} ${san} is not legal there`);
      g.move(move);
    }
    if (!g.isOver()) {
      if (p.result === "1-0") g.resign("black");
      else if (p.result === "0-1") g.resign("white");
      else if (p.result === "1/2-1/2") g.agreeDraw();
    }
    g.pgn = { tags: p.tags, lead: p.lead, notes: p.notes, sans: p.sans };
    g.aiLevel = this.aiLevel;
    g.aiSide = this.aiSide;
    g.flipped = this.flipped;
    g.book = this.book;
    g.dark = this.dark;
    g.boardSize = this.boardSize;
    g.boardFit = this.boardFit;
    this.restore(g.saved());
    this.redoSteps = [];
  }

  // ---- put away and put back

  saved(): Snapshot {
    return {
      startFen: this.startFen,
      moves: this.moveList(),
      steps: [...this.steps],
      redo: this.redoSteps.map((step) => step.map((m) => m.move.getCoordinate())),
      resigned: this.resigned,
      drawAgreed: this.drawAgreed,
      aiLevel: this.aiLevel,
      aiSide: this.aiSide,
      flipped: this.flipped,
      ...(this.book ? { book: true } : {}),
      ...(this.flagged ? { flagged: this.flagged } : {}),
      dark: this.dark,
      boardSize: this.boardSize,
      boardFit: this.boardFit,
      ...(this.pgn ? { pgn: this.pgn } : {}),
    };
  }

  /** The game as the snapshot had it: its moves played again from its start. */
  restore(s: Snapshot): void {
    const group = this.#group;
    this.#group = null;
    this.setPosition(s.startFen);
    for (const text of s.moves) {
      const move = parseMove(this.position, text);
      if (!move) throw new Error(`restore: ${text} is not legal`);
      this.move(move);
    }
    this.steps = [...s.steps];
    // The redo steps' moves played forward, next to redo first, for their
    // SAN, then all taken back.
    this.redoSteps = [];
    let played = 0;
    for (const step of [...s.redo].reverse()) {
      const made: Made[] = [];
      for (const text of step) {
        const move = parseMove(this.position, text);
        if (!move) throw new Error(`restore: ${text} to redo is not legal`);
        made.push({ move, san: toSan(this.position, move) });
        this.position.makeMove(move);
        played++;
      }
      this.redoSteps.unshift(made);
    }
    for (let i = 0; i < played; ++i) this.position.unmakeMove();
    this.resigned = s.resigned;
    this.drawAgreed = s.drawAgreed;
    this.aiLevel = s.aiLevel;
    this.aiSide = s.aiSide;
    this.flipped = s.flipped;
    this.book = s.book === true;
    this.flagged = s.flagged ?? null;
    this.dark = s.dark === true;
    if (typeof s.boardSize === "number") this.boardSize = s.boardSize;
    if (typeof s.boardFit === "boolean") this.boardFit = s.boardFit;
    this.pgn = s.pgn ?? null;
    this.#group = group === null ? null : -1;
  }
}

// What game.state (commands.ts) gives: everything the page (and GETSTATUS,
// GETGAMEINFO) read.
export interface State {
  readonly fen: string;
  readonly turn: Side;
  readonly status: string;
  readonly result: string;
  readonly check: boolean;
  readonly moves: readonly string[];      // coordinate
  readonly sans: readonly string[];
  readonly lastMove: string;              // coordinate, or ""
  readonly legalMoves: number;
  readonly halfmoveClock: number;
  readonly fullmoveNumber: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly startFen: string;
  readonly aiLevel: number;
  readonly aiSide: AiSide;
  readonly flipped: boolean;
  readonly future: readonly string[];     // the moves redo would make, in SAN
  readonly statusText: string;
  readonly capturedByWhite: readonly string[];
  readonly capturedByBlack: readonly string[];
  readonly balance: number;
  readonly dark: boolean;
  readonly boardSize: number;
  readonly boardFit: boolean;
  readonly cursor: number;                // the keyboard's cursor (view.cursor), or -1 while it is not shown
  readonly opening: string;               // the opening's name (book.ts), or ""
  readonly book: boolean;                 // the computer plays from the book
  readonly chess960: number;              // the Chess960 start it began from (chess960.ts), or -1
}

export function stateOf(game: Game): State {
  const last = game.made.length ? game.made[game.made.length - 1].move.getCoordinate() : "";
  const taken = game.captured();
  return {
    fen: game.fen(), turn: game.turn(), status: game.status(), result: game.result(), check: game.position.isKingInCheck(),
    moves: game.moveList(), sans: game.sanList(), lastMove: last, legalMoves: game.legalMoves().length,
    halfmoveClock: game.position.halfmoveClock, fullmoveNumber: game.position.fullmoveNumber,
    canUndo: game.canUndo(), canRedo: game.canRedo(), startFen: game.startFen,
    aiLevel: game.aiLevel, aiSide: game.aiSide, flipped: game.flipped,
    future: game.future().map((m) => m.san), statusText: game.statusText(),
    capturedByWhite: taken.byWhite, capturedByBlack: taken.byBlack, balance: taken.balance, dark: game.dark, boardSize: game.boardSize, boardFit: game.boardFit,
    cursor: game.cursorShown ? game.cursor : -1,
    opening: openingOf(game), book: game.book, chess960: game.chess960(),
  };
}

/** A legal move as a script sees it: {from, to, piece, capture, promotion, san}. */
export interface LegalMove {
  readonly from: string;
  readonly to: string;
  readonly piece: string;        // P, N, B, R, Q, K
  readonly capture: boolean;
  readonly promotion: string;    // "", or Q, R, B, N
  readonly san: string;
  readonly coordinate: string;
}

export function legalMovesOf(game: Game): LegalMove[] {
  return game.legalMoves().map((m) => ({
    from: m.getCoordinate().slice(0, 2), to: m.getCoordinate().slice(2, 4), piece: "PNBRQK".charAt(m.getPiece()),
    capture: m.isCapture(), promotion: m.isPromotion() ? "PNBRQK".charAt(m.getPromotedPiece()) : "", san: toSan(game.position, m), coordinate: m.getCoordinate(),
  }));
}
