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
import { Thinking, depthOf } from "./ai.ts";
import type { Game } from "./game.ts";

export const SLICE_MS = 40;
export const HARD_MS = 600;

export interface Thought {
  /** The search, read for its progress and its best move so far. */
  readonly thinking: Thinking;
  /** The game's key when it began (game.key()). */
  readonly key: string;
  readonly level: number;
  /** Stops it: no more slices, and onDone is not told. */
  cancel(): void;
}

/** Whether a page has the timers slices need (a headless test has none: there the search is one call). */
export const canSlice = (): boolean => typeof setTimeout === "function";

/**
 * Starts thinking for the side to move at the game's level. `onSlice`
 * hears each slice's end; `onDone` the search's, with the move to make
 * (coordinate notation) or null, and whether the game is still as it was.
 */
export function think(game: Game, onDone: (move: string | null, fresh: boolean, t: Thinking) => void, onSlice: (t: Thinking) => void = () => {}): Thought {
  const level = game.aiLevel;
  const thinking = new Thinking(game.positionCopy(), depthOf(level));
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
  return new Promise((resolve, reject) => {
    think(game, (move, fresh) => (fresh ? resolve(move) : reject(new Error("the game changed while the computer thought"))));
  });
}
