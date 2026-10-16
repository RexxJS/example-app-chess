// The seam under the page: every action on a game is a command, as the
// spreadsheet's are (spraedsheet's app/sheet/commands.ts). A command has an
// id ("game.move"), a label and string parameters ("from=e2 to=e4"), and
// gives an Outcome: ok or refused, a message, and sometimes an output (what
// game.state read). The page's buttons run commands and nothing else; so do
// RexxJS scripts (ADDRESS CHESS, MOVE(), GETBOARD(): control.ts,
// script.ts), the control bus and the MCP server. The commands that change
// the game are journaled as command lines, which replay.
//
// Undo here is the chess kind: game.undo takes back the last step (a move,
// or the moves one control-bus request made, folded into one step). A
// request that fails part way is taken back whole from a snapshot
// (Game.saved/restore), so nothing it did is kept.
import { getIndexFromAlgebraic } from "./chess.ts";
import { AI, depthOf } from "./ai.ts";
import { BOARD_SIZES, Game, LEVELS, stateOf } from "./game.ts";
import type { AiSide, Side, Snapshot } from "./game.ts";
import { lineOf, parseLine } from "./line.ts";
import type { Params } from "./line.ts";
import { Move } from "./move.ts";
import { runChess, runScript } from "./script.ts";
import type { ScriptHost } from "./script.ts";

export interface Outcome {
  readonly ok: boolean;
  readonly message: string;
  readonly output?: unknown;
}

interface Spec {
  readonly id: string;
  readonly label: string;
  readonly params: readonly string[];       // each required
  readonly optional?: readonly string[];
  readonly journaled: boolean;              // it changes the game
  run(game: Game, p: Params): Outcome;
}

// A command that cannot run as asked: its message is the Outcome's.
class Refused extends Error {}
const refuse = (message: string): never => { throw new Refused(message); };

// ---- Reading parameters

const squareOf = (s: string): string => {
  const t = s.trim().toLowerCase();
  return getIndexFromAlgebraic(t) >= 0 ? t : refuse(`${s} is not a square (a1 to h8)`);
};
const PROMOTIONS: Record<string, string> = { q: "q", queen: "q", r: "r", rook: "r", b: "b", bishop: "b", n: "n", knight: "n" };
const promotionOf = (s: string): string => PROMOTIONS[s.trim().toLowerCase()] ?? refuse(`${s} is not a promotion piece (queen, rook, bishop or knight)`);
const levelOf = (s: string): number => {
  const n = Number(s);
  return LEVELS.includes(n) ? n : refuse(`${s} is not a level (1 to 4)`);
};
const SIDES: readonly AiSide[] = ["white", "black", "both", "none"];
const aiSideOf = (s: string): AiSide => {
  const t = s.trim().toLowerCase() as AiSide;
  return SIDES.includes(t) ? t : refuse(`${s} is not a side (white, black, both or none)`);
};
const sideOf = (s: string): Side => {
  const t = s.trim().toLowerCase();
  return t === "white" || t === "black" ? t : refuse(`${s} is not a side (white or black)`);
};

// The move a game.move asks for: from and to (with a promotion), or san,
// or move (coordinate notation).
function moveOf(game: Game, p: Params): Move {
  if (game.isOver()) refuse(`the game is over (${game.status()}, ${game.result()})`);
  let text: string, said: string;
  if (p.san !== undefined) {
    text = p.san.trim();
    said = text;
  } else if (p.move !== undefined) {
    text = p.move.trim().toLowerCase();
    said = text;
  } else {
    const from = squareOf(p.from ?? refuse("game.move needs from and to, san, or move")), to = squareOf(p.to ?? refuse("game.move needs from and to"));
    text = from + to + (p.promotion !== undefined ? promotionOf(p.promotion) : "");
    said = `${from} to ${to}`;
  }
  if (text === "") refuse("game.move needs a move");
  // "e7e8" with no promotion is the queen, as the parser reads it.
  return game.find(text) ?? refuse(`${said} is not a legal move for ${game.turn()}`);
}

// ---- What a command gives back

export const SPECS: readonly Spec[] = [
  {
    id: "game.new", label: "New game", params: [], journaled: true,
    run: (game) => {
      game.newGame();
      return { ok: true, message: "a new game: white to move" };
    },
  },
  {
    id: "game.move", label: "Move", params: [], optional: ["from", "to", "promotion", "san", "move"], journaled: true,
    run: (game, p) => {
      const move = moveOf(game, p);
      const who = game.turn();
      const m = game.move(move);
      return { ok: true, message: `${who} played ${m.san}${game.isOver() ? ` (${game.status()}, ${game.result()})` : ""}`, output: m.san };
    },
  },
  {
    id: "game.undo", label: "Undo", params: [], journaled: true,
    run: (game) => {
      const taken = game.undo();
      if (!taken) return { ok: true, message: "nothing to undo", output: 0 };
      return { ok: true, message: `undid ${taken.map((m) => m.san).join(" ")}`, output: taken.length };
    },
  },
  {
    id: "game.redo", label: "Redo", params: [], journaled: true,
    run: (game) => {
      const back = game.redo();
      if (!back) return { ok: true, message: "nothing to redo", output: 0 };
      return { ok: true, message: `redid ${back.map((m) => m.san).join(" ")}`, output: back.length };
    },
  },
  {
    id: "game.goto", label: "Go to a move", params: ["ply"], journaled: true,
    run: (game, p) => {
      const ply = Number(p.ply);
      if (!Number.isInteger(ply) || ply < 0) refuse(`${p.ply} is not a move number (0 for the start, 1 for the first move, ...)`);
      const at = game.goto(ply);
      const sans = game.sanList();
      return { ok: true, message: at ? `at ${Math.ceil(at / 2)}${at % 2 ? "." : "..."} ${sans[at - 1]}` : "at the start", output: at };
    },
  },
  {
    id: "game.setPosition", label: "Set up a position", params: ["fen"], journaled: true,
    run: (game, p) => {
      try {
        game.setPosition(p.fen);
      } catch (e) {
        refuse((e as Error).message);
      }
      return { ok: true, message: `the position is set: ${game.turn()} to move`, output: game.fen() };
    },
  },
  {
    id: "game.resign", label: "Resign", params: [], optional: ["side"], journaled: true,
    run: (game, p) => {
      if (game.isOver()) refuse(`the game is over (${game.status()}, ${game.result()})`);
      const side = p.side !== undefined ? sideOf(p.side) : game.turn();
      game.resign(side);
      return { ok: true, message: `${side} resigns: ${game.result()}`, output: game.result() };
    },
  },
  {
    id: "game.offerDraw", label: "Offer a draw", params: [], journaled: true,
    run: (game) => {
      if (game.isOver()) refuse(`the game is over (${game.status()}, ${game.result()})`);
      // An offer is accepted: the computer player does not decline one (yet).
      game.agreeDraw();
      return { ok: true, message: "a draw is agreed: 1/2-1/2", output: game.result() };
    },
  },
  {
    id: "ai.level", label: "Computer level", params: ["level"], journaled: true,
    run: (game, p) => {
      game.aiLevel = levelOf(p.level);
      return { ok: true, message: `the computer plays at level ${game.aiLevel}`, output: game.aiLevel };
    },
  },
  {
    id: "ai.side", label: "Computer plays", params: ["side"], journaled: true,
    run: (game, p) => {
      game.aiSide = aiSideOf(p.side);
      return { ok: true, message: game.aiSide === "none" ? "the computer plays neither side" : `the computer plays ${game.aiSide}`, output: game.aiSide };
    },
  },
  {
    id: "ai.move", label: "Computer move", params: [], optional: ["move"], journaled: true,
    // The computer player (ai.ts) at the game's level: its move is one
    // step of undo, as a person's is; the same position at the same level
    // gives the same move, so a journal of ai.move lines replays. `move`:
    // the move a search already chose, made as the computer's (the page
    // and AIMOVE think in slices, think.ts, and then make it so).
    run: (game, p) => {
      if (game.isOver()) refuse(`the game is over (${game.status()}, ${game.result()})`);
      const move = p.move !== undefined
        ? game.find(p.move.trim().toLowerCase()) ?? refuse(`${p.move} is not a legal move for ${game.turn()}`)
        : new AI().search(game.position, depthOf(game.aiLevel)) ?? refuse(`the computer has no move for ${game.turn()}`);
      const who = game.turn();
      const m = game.move(move);
      return { ok: true, message: `the computer (${who}, level ${game.aiLevel}) played ${m.san}${game.isOver() ? ` (${game.status()}, ${game.result()})` : ""}`, output: m.san };
    },
  },
  {
    id: "board.flip", label: "Flip the board", params: [], journaled: true,
    run: (game) => {
      game.flipped = !game.flipped;
      return { ok: true, message: game.flipped ? "black at the bottom" : "white at the bottom", output: game.flipped ? 1 : 0 };
    },
  },
  {
    id: "game.script", label: "The game as a script", params: [], journaled: false,
    run: (game) => ({ ok: true, message: `the game as a script: ${game.made.length} moves`, output: game.toScript() }),
  },
  {
    id: "game.export", label: "Save the game", params: [], journaled: false,
    run: (game) => ({ ok: true, message: `the game as its file: ${game.made.length} moves`, output: JSON.stringify(game.toFile(), null, 2) }),
  },
  {
    id: "game.import", label: "Open a game", params: ["text"], journaled: true,
    run: (game, p) => {
      try {
        game.fromFile(p.text);
      } catch (e) {
        refuse((e as Error).message);
      }
      return { ok: true, message: `opened a game of ${game.made.length} moves: ${game.turn()} to move`, output: game.made.length };
    },
  },
  {
    id: "view.dark", label: "Dark mode", params: [], optional: ["on"], journaled: true,
    run: (game, p) => {
      if (p.on !== undefined && !/^(0|1|on|off|true|false|yes|no)$/i.test(p.on.trim())) refuse(`${p.on} is not on or off (1 or 0)`);
      game.dark = p.on === undefined ? !game.dark : /^(1|on|true|yes)$/i.test(p.on.trim());
      return { ok: true, message: game.dark ? "dark mode" : "light mode", output: game.dark ? 1 : 0 };
    },
  },
  {
    id: "view.boardSize", label: "Board size", params: [], optional: ["px", "by"], journaled: true,
    run: (game, p) => {
      let px = game.boardSize;
      if (p.px !== undefined) px = Number(p.px);
      else if (p.by !== undefined) px = game.boardSize + Number(p.by);
      if (!Number.isInteger(px)) refuse(`${p.px ?? p.by} is not a number of pixels`);
      if (px < BOARD_SIZES.min || px > BOARD_SIZES.max) {
        if (p.by === undefined) refuse(`a board is ${BOARD_SIZES.min} to ${BOARD_SIZES.max} pixels, not ${px}`);
        px = Math.max(BOARD_SIZES.min, Math.min(BOARD_SIZES.max, px));
      }
      game.boardSize = px;
      return { ok: true, message: `the board is ${px} pixels square`, output: px };
    },
  },
  {
    id: "game.state", label: "The game's state", params: [], journaled: false,
    run: (game) => ({ ok: true, message: `${game.turn()} to move, ${game.status()}`, output: stateOf(game) }),
  },
];

const BY_ID = new Map(SPECS.map((s) => [s.id, s]));

export class Commands {
  readonly game: Game;
  readonly #journal: string[] = [];

  constructor(game: Game = new Game()) {
    this.game = game;
  }

  // Every command whose id or label holds `search` (any case).
  catalogue(search = ""): { id: string; label: string; params: string }[] {
    const s = search.toLowerCase();
    return SPECS.filter((c) => c.id.toLowerCase().includes(s) || c.label.toLowerCase().includes(s))
      .map((c) => ({ id: c.id, label: c.label, params: [...c.params, ...(c.optional ?? []).map((o) => `${o}?`)].join(", ") }));
  }

  execute(id: string, params: Params = {}): Outcome {
    const spec = BY_ID.get(id);
    try {
      if (!spec) refuse(`no command ${id}`);
      for (const name of spec!.params) if (params[name] === undefined) refuse(`${id} needs ${name}`);
      const outcome = spec!.run(this.game, params);
      if (outcome.ok && spec!.journaled) this.#journal.push(lineOf(id, params));
      return outcome;
    } catch (e) {
      if (e instanceof Refused) return { ok: false, message: e.message };
      throw e;
    }
  }

  run(line: string): Outcome {
    const { id, params } = parseLine(line);
    return this.execute(id, params);
  }

  // The command lines that changed the game, in order.
  journal(): string[] {
    return [...this.#journal];
  }

  // A RexxJS script, driving these commands (script.ts); `say` gets its
  // SAY lines. The whole script's moves are one step of undo.
  async script(text: string, say: (line: string) => void): Promise<{ ok: boolean; message: string }> {
    this.game.beginGroup();
    try {
      return await runScript(text, this.#scriptHost(), say);
    } finally {
      this.game.endGroup();
    }
  }

  // One control-bus string (script.ts's runChess). One step of undo,
  // however many moves it makes; and all or nothing: a request that fails
  // part way (MOVE("e2", "e4"); BOGUS()) is taken back whole, so the
  // program that sent it, told it failed, finds the game as it was.
  async chess(code: string, say: (line: string) => void): Promise<{ ok: boolean; message: string; output?: unknown }> {
    // One the bus gave up on, still open: ended, not taken back, as what the
    // person did since may be in it.
    if (this.#request) {
      this.game.endGroup();
      this.#request = null;
    }
    const request = { cancelled: false, before: this.game.saved() };
    this.#request = request;
    this.game.beginGroup();
    let o: { ok: boolean; message: string; output?: unknown } = { ok: false, message: "the request did not finish" };
    let mine = false;
    try {
      o = await runChess(code, this.#scriptHost(request), say);
    } finally {
      if (request.cancelled) o = { ok: false, message: "the request was stopped" };
      if (this.#request === request) {
        this.game.endGroup();
        this.#request = null;
        mine = true;
      }
    }
    if (!o.ok && mine) return { ...o, message: `${o.message}${this.#takeBack(request.before)}` };
    return o;
  }

  // The request in flight, which sae's control bus answered without it
  // (bus.serve's stopped): "interrupted", the page's time limit stopped it
  // and it will not come back, so it is taken back now; "deadline", it was
  // still running at the bus's 10 s, so it is cancelled: its next command
  // fails, and it is taken back as any failed request is.
  stopped(reason: string): string {
    const request = this.#request;
    if (!request) return "";
    request.cancelled = true;
    if (reason !== "interrupted") return "cancelled";
    this.#request = null;
    this.game.endGroup();
    return `taken back${this.#takeBack(request.before)}`;
  }

  #request: { cancelled: boolean; before: Snapshot } | null = null;

  // The game as it was before a failed request.
  #takeBack(before: Snapshot): string {
    this.game.restore(before);
    return " (nothing it did was kept)";
  }

  // What a script reaches the game by; for a control-bus request, each
  // command refused once the bus has stopped it.
  #scriptHost(request?: { cancelled: boolean }): ScriptHost {
    const live = () => {
      if (request?.cancelled) throw new Error("the request was stopped");
    };
    return {
      game: this.game,
      run: (line: string) => (live(), this.run(line)),
      execute: (id: string, params: Record<string, string>) => (live(), this.execute(id, params)),
    };
  }
}
