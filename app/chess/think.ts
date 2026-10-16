// Thinking off the page's work (TODO.md 4.2): the computer's search in
// slices a timer apart, so no one entry into the page's JavaScript runs
// near sae's limit (5 s; the specs run with 1 s), and the page answers
// its person, its buttons and the driver meanwhile. sae has no background
// work for a page yet (its page-services.md section 7, workers as Aether
// actors, is a design), so the slices are timers: setTimeout, the page's.
//
// A slice searches root moves for about SLICE_MS, and never past HARD_MS
// (ai.ts's Thinking gives up the depth in progress then, and the move of
// the depth before stands). The search runs on a copy of the game's
// position; when it ends, the move is made by the ai.move command, so it
// is one step of undo and journaled. A game that changes while the
// computer thinks (a move, an undo, a new game) leaves the search stale:
// it is dropped, not played.
import { AI, Thinking, depthOf } from "./ai.ts";
import type { Game } from "./game.ts";
import { analysisOf } from "./analysis.ts";
import type { Analysis } from "./analysis.ts";

export const SLICE_MS = 40;
export const HARD_MS = 600;

export interface Thought {
  /** The search, read for its progress and its best move so far; null for the native engine's, which is one call. */
  readonly thinking: Thinking | null;
  /** The game's key when it began (game.key()). */
  readonly key: string;
  readonly level: number;
  /** Stops it: no more slices, and onDone is not told. */
  cancel(): void;
}

/** Whether a page has the timers slices need (a headless test has none: there the search is one call). */
export const canSlice = (): boolean => typeof setTimeout === "function";

/**
 * Starts thinking for the side to move at the game's level (or `depth`). `onSlice`
 * hears each slice's end; `onDone` the search's, with the move to make
 * (coordinate notation) or null, and whether the game is still as it was.
 */
export function think(game: Game, onDone: (move: string | null, fresh: boolean, t: Thinking) => void, onSlice: (t: Thinking) => void = () => {}, depth?: number): Thought {
  const level = game.aiLevel;
  const thinking = new Thinking(game.positionCopy(), depth ?? depthOf(level));
  const key = game.key();
  let live = true;
  const slice = () => {
    if (!live) return;
    const done = thinking.step(SLICE_MS, HARD_MS);
    onSlice(thinking);
    if (!done) {
      setTimeout(slice, 0);
      return;
    }
    live = false;
    onDone(thinking.best?.getCoordinate() ?? null, game.key() === key, thinking);
  };
  setTimeout(slice, 0);
  return { thinking, key, level, cancel: () => { live = false; } };
}

/** The computer's move, thought in slices: its coordinate notation, or null for none; refused when the game changed meanwhile. */
export function thinkOnce(game: Game): Promise<string | null> {
  if (hasNative()) {
    const key = game.key();
    return searchNative(game, depthOf(game.aiLevel)).then((l) => {
      if (game.key() !== key) throw new Error("the game changed while the computer thought");
      return l.best;
    });
  }
  return new Promise((resolve, reject) => {
    think(game, (move, fresh) => (fresh ? resolve(move) : reject(new Error("the game changed while the computer thought"))));
  });
}

/** The position analysed `depth` half-moves deep, in slices; refused when the game changed meanwhile. */
export function analyzeOnce(game: Game, depth: number): Promise<Analysis> {
  return new Promise((resolve, reject) => {
    think(game, (_move, fresh, t) => (fresh ? resolve(analysisOf(game, t)) : reject(new Error("the game changed while the computer thought"))), () => {}, depth);
  });
}

// ---- the engine in Aether (TODO.md 4.4): app/native/engine.ae, compiled
// into the app's own sae (sae's docs/natives.md) and reached as
// natives.engine.search, a string in and a promise of a string out, run off
// the UI thread. The page hands it over (useNative) when it has it; with
// none (sae's own build, a headless test) the TypeScript engine above
// thinks. Both give the same move, value, depth, ties and node counts for
// a position and a depth (tests/native/check.sh, spec_app_chess_native).

/** A search's line, as both engines give it. */
export interface Line {
  readonly best: string | null;     // coordinate notation
  readonly value: number;
  readonly reached: number;
  readonly ties: number;
  readonly nodes: number;
  readonly evaluations: number;
  readonly engine: "native" | "typescript";
}

export type NativeSearch = (arg: string) => Promise<string>;
let nativeSearch: NativeSearch | null = null;

/** The page's natives.engine.search, or null for none. */
export function useNative(fn: NativeSearch | null): void {
  nativeSearch = fn;
}

export const hasNative = (): boolean => nativeSearch !== null;

/** What the native search takes: the depth, the seed, the game's start and its moves, so it knows the game's repetitions as positionCopy does. */
export function nativeArg(game: Game, depth: number, seed = 0): string {
  return `${depth}|${seed}|${game.startFen}|${game.moveList().join(" ")}`;
}

/** The native engine's answer read: "best=e2e4 value=35 reached=4 ties=1 nodes=2338 evaluations=1675". */
export function lineOf(text: string): Line {
  const f: Record<string, string> = {};
  for (const w of text.trim().split(/\s+/)) {
    const at = w.indexOf("=");
    if (at > 0) f[w.slice(0, at)] = w.slice(at + 1);
  }
  if (f.best === undefined) throw new Error(`the native engine said ${text}`);
  return { best: f.best === "none" ? null : f.best, value: Number(f.value), reached: Number(f.reached), ties: Number(f.ties), nodes: Number(f.nodes), evaluations: Number(f.evaluations), engine: "native" };
}

/** The native engine's search of the game now, `depth` half-moves deep. */
export async function searchNative(game: Game, depth: number): Promise<Line> {
  if (!nativeSearch) throw new Error("no native engine in this sae (the app's own is built by sae's tools/saehost.sh)");
  return lineOf(await nativeSearch(nativeArg(game, depth)));
}

/** The TypeScript engine's search of the game now, to its end (no deadline), in slices where there are timers; as the native one, for comparing them. */
export function searchTypescript(game: Game, depth: number): Promise<Line> {
  const ai = new AI();
  const t = new Thinking(game.positionCopy(), depth, ai, 0);
  const line = (): Line => ({ best: t.best?.getCoordinate() ?? null, value: t.bestValue, reached: t.reached, ties: t.ties.length, nodes: ai.nodes, evaluations: ai.evaluations, engine: "typescript" });
  if (!canSlice()) {
    t.step();
    return Promise.resolve(line());
  }
  return new Promise((resolve) => {
    const slice = () => (t.step(SLICE_MS, Infinity) ? resolve(line()) : setTimeout(slice, 0));
    setTimeout(slice, 0);
  });
}

/** The computer's move by the native engine, as think() gives it: onDone with the move and whether the game is as it was. */
export function thinkNative(game: Game, onDone: (move: string | null, fresh: boolean) => void): Thought {
  const key = game.key(), level = game.aiLevel;
  let live = true;
  searchNative(game, depthOf(level)).then((l) => {
    if (live) onDone(l.best, game.key() === key);
  }, (e) => {
    if (live) {
      print(`chess: the native engine failed: ${(e as Error).message}`);
      onDone(null, false);
    }
  });
  return { thinking: null, key, level, cancel: () => { live = false; } };
}
