// Clocks (TODO.md 6.2): a time control per side ("5+3": five minutes
// each, three seconds added after each move made), the side to move's
// clock running, and the flag falling when it reaches zero: that side
// loses on time, unless the other has not the pieces to mate, when it is
// a draw (game.ts's flagFall). No ui and no clock of its own: the time is
// read from `now`, given to each call, so a test runs it on a fake clock
// and the page on Date.now.
//
// The clock runs for the side to move from when it is set (or the game
// starts again), stops while the game is over, and is charged on every
// sync: after a command (a move, an undo, a new game: commands.ts) and on
// each tick the page makes. A move adds the increment to the side that
// made it; an undo takes no time back.
import type { Game, Side } from "./game.ts";

/** A time control: the time each side starts with, and the increment a move, in ms. */
export interface Control {
  readonly base: number;
  readonly inc: number;
}

/**
 * A time control from its text: "5+3" (minutes, then seconds added a
 * move), "1:30+0" (minutes and seconds), "0:05" (no increment), "0.5+1";
 * throws saying what is wrong.
 */
export function controlOf(text: string): Control {
  const m = /^\s*(?:(\d+):([0-5]\d)|(\d+(?:\.\d+)?))\s*(?:\+\s*(\d+(?:\.\d+)?))?\s*$/.exec(text);
  if (!m) throw new Error(`${text} is not a time control ("5+3": minutes, then the seconds added a move; "1:30+0"; or "none")`);
  const base = m[3] !== undefined ? Number(m[3]) * 60000 : (Number(m[1]) * 60 + Number(m[2])) * 1000;
  const inc = m[4] !== undefined ? Number(m[4]) * 1000 : 0;
  if (base <= 0) throw new Error(`a time control gives some time, not ${text}`);
  if (base > 10 * 3600000 || inc > 600000) throw new Error(`${text} is more time than a clock here keeps (ten hours, ten minutes a move)`);
  return { base: Math.round(base), inc: Math.round(inc) };
}

/** A control as text, as controlOf reads it: "5+3", "1:30+0". */
export function controlText(c: Control): string {
  const s = c.base / 1000;
  const base = s % 60 === 0 ? String(s / 60) : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  return `${base}+${c.inc / 1000}`;
}

/** Time left as a clock shows it: "4:57" (and tenths under twenty seconds: "0:09.4"), "1:02:03" past an hour. */
export function timeText(ms: number): string {
  const t = Math.max(0, ms);
  if (t < 20000) {
    const tenths = Math.floor(t / 100);
    return `0:${String(Math.floor(tenths / 10)).padStart(2, "0")}.${tenths % 10}`;
  }
  const s = Math.floor(t / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

/** What a clock shows and a script reads. */
export interface ClockState {
  readonly control: string;           // "5+3"
  readonly white: number;             // ms left
  readonly black: number;
  readonly running: Side | "";        // whose clock runs, "" for none (the game over)
  readonly flag: Side | "";           // whose flag fell, "" for none
}

export class Clock {
  readonly control: Control;
  readonly left: Record<Side, number>;
  running: Side | null = null;
  flag: Side | null = null;
  #since = 0;
  #plies = 0;

  constructor(control: Control, game: Game, now: number) {
    this.control = control;
    this.left = { white: control.base, black: control.base };
    this.#start(game, now);
  }

  #start(game: Game, now: number): void {
    this.running = game.isOver() ? null : game.turn();
    this.#since = now;
    this.#plies = game.made.length;
  }

  /** Both clocks back to the control's time, running for the side to move (a new game). */
  reset(game: Game, now: number): void {
    this.left.white = this.control.base;
    this.left.black = this.control.base;
    this.flag = null;
    this.#start(game, now);
  }

  /** The running clock charged to `now`; the side whose flag fell, or null. */
  tick(now: number): Side | null {
    if (this.running && !this.flag) {
      this.left[this.running] -= Math.max(0, now - this.#since);
      if (this.left[this.running] <= 0) {
        this.left[this.running] = 0;
        this.flag = this.running;
        this.running = null;
      }
    }
    this.#since = now;
    return this.flag;
  }

  /**
   * After the game changed: the time to `now` charged to the side that was
   * running, the increment to each side for each move it made since, and
   * the clock then running for the side to move (none once the game is
   * over). The side whose flag fell, or null.
   */
  sync(game: Game, now: number): Side | null {
    const fell = this.tick(now);
    const n = game.made.length;
    if (n > this.#plies && !fell) {
      for (let ply = this.#plies; ply < n; ++ply) {
        // The ply-th move (0 first) was made by the side to move before it.
        const startsWhite = game.startFen.split(" ")[1] !== "b";
        const mover: Side = (ply % 2 === 0) === startsWhite ? "white" : "black";
        this.left[mover] += this.control.inc;
      }
    }
    this.#plies = n;
    this.running = this.flag || game.isOver() ? null : game.turn();
    return this.flag;
  }

  /** Sets a side's time left (a handicap, or a test). */
  set(side: Side, ms: number): void {
    this.left[side] = Math.max(0, Math.round(ms));
    if (this.left[side] > 0 && this.flag === side) this.flag = null;
  }

  state(): ClockState {
    return { control: controlText(this.control), white: this.left.white, black: this.left.black, running: this.running ?? "", flag: this.flag ?? "" };
  }
}
