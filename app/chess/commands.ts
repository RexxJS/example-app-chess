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
import { Game, LEVELS } from "./game.ts";
import type { AiSide, Side } from "./game.ts";
import { Move } from "./move.ts";
import { toSan } from "./parser.ts";

export type Params = Readonly<Record<string, string>>;

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

// ---- The command line: an id, then name=value pairs; a value with spaces,
// quotes or '=' is quoted, "" being a quote inside.

export function parseLine(line: string): { id: string; params: Record<string, string> } {
  const m = /^\s*(\S+)/.exec(line);
  const params: Record<string, string> = {};
  let rest = line.slice(m ? m[0].length : 0);
  for (;;) {
    const p = /^\s*([A-Za-z_][\w]*)=("(?:[^"]|"")*"|\S*)/.exec(rest);
    if (!p) break;
    params[p[1]] = p[2].startsWith('"') ? p[2].slice(1, -1).replace(/""/g, '"') : p[2];
    rest = rest.slice(p[0].length);
  }
  return { id: m ? m[1] : "", params };
}

export function lineOf(id: string, params: Params): string {
  const value = (v: string) => (v === "" || /[\s"=]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [id, ...Object.entries(params).map(([k, v]) => `${k}=${value(v)}`)].join(" ");
}

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

const made = (game: Game, san: string, what: string): Outcome => ({ ok: true, message: `${what} ${san}`, output: san });

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
      // No one to decline yet: an offer is accepted (the computer player of stage 4 may decline).
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
    id: "ai.move", label: "Computer move", params: [], journaled: true,
    // Stage 4 of TODO.md brings the computer player (ai.ts); until then
    // the command is here for scripts and the page, and says so.
    run: (game) => {
      if (game.isOver()) refuse(`the game is over (${game.status()}, ${game.result()})`);
      return refuse("no computer player yet (stage 4 of TODO.md)");
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
    id: "game.state", label: "The game's state", params: [], journaled: false,
    run: (game) => ({ ok: true, message: `${game.turn()} to move, ${game.status()}`, output: stateOf(game) }),
  },
];

// What game.state gives: everything the page (and GETSTATUS, GETGAMEINFO)
// read.
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
}

export function stateOf(game: Game): State {
  const last = game.made.length ? game.made[game.made.length - 1].move.getCoordinate() : "";
  return {
    fen: game.fen(), turn: game.turn(), status: game.status(), result: game.result(), check: game.position.isKingInCheck(),
    moves: game.moveList(), sans: game.sanList(), lastMove: last, legalMoves: game.legalMoves().length,
    halfmoveClock: game.position.halfmoveClock, fullmoveNumber: game.position.fullmoveNumber,
    canUndo: game.canUndo(), canRedo: game.canRedo(), startFen: game.startFen,
    aiLevel: game.aiLevel, aiSide: game.aiSide, flipped: game.flipped,
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
}
