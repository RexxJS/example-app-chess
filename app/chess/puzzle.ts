// Puzzles (TODO.md 6.4): a position and a goal, mate in n for the side to
// move, checked as the person plays: each of their moves must keep a
// forced mate in the moves left (a mate search, `mateIn`, proves it), and
// the computer answers with the defence that holds out longest. A set of
// puzzles is text, a puzzle a line:
//
//   <FEN> ; mate in <n> ; <title>
//
// with "#" starting a comment line. The app has its own set (SET below,
// composed for it and each proved by chess_puzzle); another is read from a
// file the person picks, or given to IMPORTPUZZLES.
import type { Move } from "./move.ts";
import type { Position } from "./position.ts";
import { fromFen } from "./parser.ts";

export interface Puzzle {
  readonly fen: string;
  readonly mateIn: number;
  readonly title: string;
}

/** The app's own puzzles: mates in one to three, each proved exact by chess_puzzle. */
export const SET = `# The chess app's puzzles: <FEN> ; mate in <n> ; <title>
6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1 ; mate in 1 ; The back rank
r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4 ; mate in 1 ; Four moves in
r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1 ; mate in 1 ; Black's back-rank mate
6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1 ; mate in 1 ; Smothered
7k/8/8/8/8/8/R7/1R4K1 w - - 0 1 ; mate in 2 ; The rook ladder
k7/8/2K5/8/8/8/8/7R w - - 0 1 ; mate in 2 ; King and rook
7r/8/8/8/2k5/8/8/K7 b - - 0 1 ; mate in 2 ; Black's king and rook
k7/8/8/3K4/8/8/8/7R w - - 0 1 ; mate in 3 ; The king comes up
1k6/8/8/3K4/8/8/8/7R w - - 0 1 ; mate in 3 ; The rook cuts the board
7r/8/8/8/3k4/8/8/K7 b - - 0 1 ; mate in 3 ; Black's king comes down
`;

/** A set read from its text; throws saying which line is wrong and why. */
export function parsePuzzles(text: string): Puzzle[] {
  const out: Puzzle[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split(";").map((p) => p.trim());
    if (parts.length < 2) throw new Error(`puzzles, line ${i + 1}: <FEN> ; mate in <n> ; <title>, not "${line}"`);
    const [fen, goal, ...rest] = parts;
    const m = /^mate in ([1-9])$/i.exec(goal);
    if (!m) throw new Error(`puzzles, line ${i + 1}: the goal is "mate in <n>" (1 to 9), not "${goal}"`);
    try {
      fromFen(fen);
    } catch (e) {
      throw new Error(`puzzles, line ${i + 1}: ${(e as Error).message}`);
    }
    out.push({ fen, mateIn: Number(m[1]), title: rest.join(";").trim() || `Puzzle ${out.length + 1}` });
  });
  if (!out.length) throw new Error("puzzles: none in the text");
  return out;
}

// The legal moves now (getMoves gives them legal).
const movesOf = (p: Position): Move[] => p.getMoves();

/** Whether the side to move in `p` mates in at most `n` moves of its own, whatever the defence. */
export function mateIn(p: Position, n: number): boolean {
  if (n <= 0) return false;
  for (const m of movesOf(p)) {
    if (!p.makeMove(m)) continue;
    const ok = defended(p, n);
    p.unmakeMove();
    if (ok) return true;
  }
  return false;
}

// The defender to move, the attacker having `n` moves (this one made):
// mated now, or every reply leaves a mate in n - 1.
function defended(p: Position, n: number): boolean {
  const replies = movesOf(p);
  if (!replies.length) return p.isKingInCheck();
  if (n <= 1) return false;
  for (const r of replies) {
    if (!p.makeMove(r)) continue;
    const ok = mateIn(p, n - 1);
    p.unmakeMove();
    if (!ok) return false;
  }
  return true;
}

/** The fewest moves the side to move mates in, up to `most`; 0 when it cannot so soon. */
export function mateDistance(p: Position, most: number): number {
  for (let n = 1; n <= most; ++n) if (mateIn(p, n)) return n;
  return 0;
}

/**
 * The defence that holds out longest against a mate in `n` (the
 * attacker's moves left, the defender to move): the reply after which the
 * attacker needs the most moves to mate (none at all, if one escapes);
 * the first such in move order. Null when the defender has no move.
 */
export function bestDefence(p: Position, n: number): Move | null {
  let best: Move | null = null, bestN = -1;
  for (const r of movesOf(p)) {
    if (!p.makeMove(r)) continue;
    const d = mateDistance(p, n);
    p.unmakeMove();
    const score = d === 0 ? n + 1 : d;
    if (score > bestN) {
      bestN = score;
      best = r;
    }
  }
  return best;
}

/** A puzzle under way: which, who solves it, how many of their moves are left, and how it stands. */
export interface PuzzleRun {
  readonly index: number;            // in the set, from 1
  readonly puzzle: Puzzle;
  readonly solver: "white" | "black";
  left: number;                      // the solver's moves left
  state: "solving" | "solved" | "failed";
  why: string;                       // what was wrong, when failed
}

/** The start of a run: the side to move in its FEN solves it. */
export function startRun(set: readonly Puzzle[], index: number): PuzzleRun {
  const puzzle = set[index - 1];
  return { index, puzzle, solver: puzzle.fen.trim().split(/\s+/)[1] === "b" ? "black" : "white", left: puzzle.mateIn, state: "solving", why: "" };
}


/** After the solver's move, the defender to move: mated, or every reply still leaves a mate in `left` - 1 of the solver's moves. */
export const stillMates = (p: Position, left: number): boolean => defended(p, left);

/**
 * The puzzles of a game (commands.ts holds one): the set, and the run
 * under way, kept to the game as it changes. `game` is a game.ts Game; the
 * moves the defender makes are made on it, as the computer's are.
 */
export class Puzzles {
  set: Puzzle[] = parsePuzzles(SET);
  run: PuzzleRun | null = null;

  /** Puzzle `n` of the set (from 1) on the board, the side to move to solve it. */
  load(game: GameLike, n: number): PuzzleRun {
    if (!Number.isInteger(n) || n < 1 || n > this.set.length) throw new Error(`${n} is not a puzzle here (1 to ${this.set.length})`);
    const run = startRun(this.set, n);
    game.setPosition(run.puzzle.fen);
    this.run = run;
    return run;
  }

  /** A set in place of this one, from its text; the run under way ends. */
  import(text: string): number {
    this.set = parsePuzzles(text);
    this.run = null;
    return this.set.length;
  }

  /**
   * The game changed by a command (`id`): a move by the solver is checked
   * (a mate is solved; a move after which no mate in the moves left can be
   * forced, or the last move without mate, fails) and the defence is made;
   * an undo goes back to the solver's move, and the run goes on from
   * there; a game started otherwise leaves the puzzle.
   */
  changed(game: GameLike, id: string): void {
    const run = this.run;
    if (!run) return;
    if (game.startFen.split(" ").slice(0, 4).join(" ") !== run.puzzle.fen.trim().split(/\s+/).slice(0, 4).join(" ")) {
      this.run = null;
      return;
    }
    const solverToMove = () => game.turn() === run.solver;
    if (id === "game.undo" || id === "game.redo" || id === "game.goto") {
      if (id === "game.undo" && !solverToMove() && game.made.length) game.undo();
      run.state = "solving";
      run.why = "";
      run.left = run.puzzle.mateIn - Math.ceil(game.made.length / 2);
      if (!solverToMove() && !game.isOver()) this.#defend(game);
      return;
    }
    if (run.state !== "solving" || solverToMove()) return;
    // The solver has moved.
    if (game.status() === "checkmate") {
      run.state = "solved";
      run.left = run.puzzle.mateIn - Math.ceil(game.made.length / 2);
      return;
    }
    const left = run.puzzle.mateIn - Math.ceil(game.made.length / 2) + 1;   // before this move
    if (left <= 1) {
      run.state = "failed";
      run.why = `no mate in ${run.puzzle.mateIn}: the last move was not mate`;
    } else if (game.isOver() || !stillMates(game.position, left)) {
      run.state = "failed";
      run.why = game.isOver() ? `the game ended without mate (${game.status()})` : `after that the mate can be escaped: no forced mate in ${left - 1} more`;
    }
    run.left = left - 1;
    if (run.state === "solving") this.#defend(game);
  }

  // The defender's reply, the longest-holding.
  #defend(game: GameLike): void {
    const run = this.run!;
    const reply = bestDefence(game.position, Math.max(1, run.left));
    if (reply) game.move(reply);
  }

  /** How the run stands, for the page and a script. */
  state(): PuzzleState | null {
    const r = this.run;
    if (!r) return null;
    return { index: r.index, count: this.set.length, title: r.puzzle.title, goal: `mate in ${r.puzzle.mateIn}`, solver: r.solver, left: r.left, state: r.state, why: r.why };
  }
}

export interface PuzzleState {
  readonly index: number;
  readonly count: number;
  readonly title: string;
  readonly goal: string;
  readonly solver: "white" | "black";
  readonly left: number;
  readonly state: "solving" | "solved" | "failed";
  readonly why: string;
}

/** The part of a game (game.ts) the puzzles use: no import of it, which would be a cycle. */
export interface GameLike {
  readonly position: Position;
  readonly startFen: string;
  readonly made: readonly unknown[];
  turn(): "white" | "black";
  status(): string;
  isOver(): boolean;
  setPosition(fen: string): void;
  move(move: Move): unknown;
  undo(): unknown;
}
