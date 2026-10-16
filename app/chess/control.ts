// The control functions: what a REXX script, the control bus and the MCP
// server call the game by. Each one runs a command (commands.ts): MOVE("e2",
// "e4") runs game.move from=e2 to=e4 and gives back what it gave, as the
// spreadsheet's control.ts does for the sheet. The old app's 12 ADDRESS
// CHESS commands (CHESS_COMMANDS.md: move, get-board, get-moves, undo,
// redo, new-game, set-ai-difficulty, get-status, get-move-history,
// get-position-fen, list-legal-moves, get-game-info) are each a function
// here by a new name, and script.ts keeps the old lines working. The
// functions see the game only through `exec`, a command and its
// parameters in and its outcome out, as a button does.
import { RANK_CHARACTERS, getIndex, getIndexFromAlgebraic, getPieceCharacter } from "./chess.ts";
import { LEVELS, legalMovesOf } from "./game.ts";
import type { Game, State } from "./game.ts";
import { DESCRIBED, signature } from "./described.ts";
import { analyzeOnce, canSlice, hasNative, searchNative, searchTypescript, thinkOnce } from "./think.ts";
import type { Analysis } from "./analysis.ts";
import { bookMove, bookMoves } from "./book.ts";
import { timeText } from "./clock.ts";
import type { ClockState } from "./clock.ts";
import type { PuzzleState } from "./puzzle.ts";

export interface Done {
  readonly ok: boolean;
  readonly message: string;
  readonly output?: unknown;
}
export type Exec = (id: string, params: Record<string, string>) => Done;
type Control = (exec: Exec, game: Game, ...args: any[]) => unknown;

export const VERSION = "sae chess";

// A command that must be done: a refusal is the function's error, as the
// old app's handler gave RC and an error.
function must(exec: Exec, id: string, params: Record<string, string> = {}): Done {
  const o = exec(id, params);
  if (!o.ok) throw new Error(o.message);
  return o;
}
const state = (exec: Exec) => must(exec, "game.state").output as State;

const text = (a: unknown) => (a === undefined || a === null ? "" : String(a));
const yes = (a: unknown) => a === 1 || a === "1" || a === true || a === "true";
function square(a: unknown, fn: string): string {
  const s = text(a).trim().toLowerCase();
  if (getIndexFromAlgebraic(s) < 0) throw new Error(`${fn} needs a square (e.g. "e4"), not "${text(a)}"`);
  return s;
}
// A REXX stem: {0: count, 1: first, ...}.
const stem = (xs: readonly unknown[]): Record<string, unknown> => Object.fromEntries([[0, xs.length], ...xs.map((x, i) => [i + 1, x])]);
const unstem = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return JSON.parse(v) as unknown[];
  const s = v as Record<string, unknown>;
  return Array.from({ length: Number(s?.[0] ?? 0) }, (_, i) => s[i + 1]);
};

/** The board as the old get-board drew it: the Unicode pieces, "." for empty, files and ranks around. */
export function boardOf(game: Game): string {
  const lines = ["  a b c d e f g h"];
  for (let rank = 7; rank >= 0; --rank) {
    const cells: string[] = [];
    for (let file = 0; file < 8; ++file) {
      const index = getIndex(rank, file);
      const piece = game.position.getPieceAtOrNull(index);
      cells.push(piece === null ? "." : getPieceCharacter(piece, game.position.getColorAtOrNull(index)!));
    }
    lines.push(`${RANK_CHARACTERS[rank]} ${cells.join(" ")} ${RANK_CHARACTERS[rank]}`);
  }
  lines.push("  a b c d e f g h");
  return lines.join("\n");
}

// An analysis as REXX has it: the variation a stem.
const analysisStem = (a: Analysis) => ({ value: a.value, mate: a.mate, text: a.text, best: a.best, coordinate: a.coordinate, pv: stem(a.pv), depth: a.depth, nodes: a.nodes });

const status = (s: State) => ({ status: s.status, toPlay: s.turn, isCheck: s.check ? 1 : 0, legalMoves: s.legalMoves, result: s.result });

export const CONTROL: Readonly<Record<string, Control>> = {
  CHESS_VERSION: () => VERSION,
  MOVE: (exec, _g, from, to, promotion) => must(exec, "game.move", {
    from: square(from, "MOVE"), to: square(to, "MOVE"), ...(promotion === undefined || text(promotion) === "" ? {} : { promotion: text(promotion) }),
  }).output,
  MOVESAN: (exec, _g, san) => must(exec, "game.move", { san: text(san) }).output,
  UNDO: (exec) => must(exec, "game.undo").output,
  REDO: (exec) => must(exec, "game.redo").output,
  NEWGAME: (exec) => (must(exec, "game.new"), "OK"),
  NEWGAME960: (exec, _g, n) => must(exec, "game.new960", n === undefined || text(n) === "" ? {} : { n: text(n) }).output,
  CHESS960NUMBER: (exec) => state(exec).chess960,
  SETPOSITION: (exec, _g, fen) => must(exec, "game.setPosition", { fen: text(fen) }).output,
  RESIGN: (exec, _g, side) => must(exec, "game.resign", side === undefined || text(side) === "" ? {} : { side: text(side) }).output,
  OFFERDRAW: (exec) => must(exec, "game.offerDraw").output,
  GETBOARD: (_e, game) => boardOf(game),
  GETFEN: (exec) => state(exec).fen,
  GETMOVES: (_e, game) => stem(legalMovesOf(game).map((m) => m.coordinate)),
  LISTLEGALMOVES: (_e, game) => stem(legalMovesOf(game).map((m) => ({ ...m, capture: m.capture ? 1 : 0 }))),
  GETSTATUS: (exec) => status(state(exec)),
  GETMOVEHISTORY: (exec) => stem(state(exec).moves),
  GETMOVEHISTORYSAN: (exec) => stem(state(exec).sans),
  LASTMOVE: (exec) => {
    const s = state(exec);
    const ply = s.sans.length;
    return { san: ply ? s.sans[ply - 1] : "", coordinate: s.lastMove, ply, by: ply ? ((ply % 2 === 1) === (s.startFen.split(" ")[1] !== "b") ? "white" : "black") : "" };
  },
  GETGAMEINFO: (exec, game) => {
    const s = state(exec);
    return {
      status: s.status, toPlay: s.turn, isCheck: s.check ? 1 : 0, legalMoveCount: s.legalMoves, halfMoveClock: s.halfmoveClock, fullMoveNumber: s.fullmoveNumber,
      result: s.result, fen: s.fen, lastMove: s.lastMove, moves: stem(s.sans), canUndo: s.canUndo ? 1 : 0, canRedo: s.canRedo ? 1 : 0,
      aiLevel: s.aiLevel, aiSide: s.aiSide, flipped: s.flipped ? 1 : 0, board: boardOf(game),
    };
  },
  GOTOMOVE: (exec, _g, ply) => must(exec, "game.goto", { ply: text(ply) }).output,
  GETCAPTURED: (exec) => {
    const s = state(exec);
    return { white: s.capturedByWhite.join(""), black: s.capturedByBlack.join(""), balance: s.balance };
  },
  GAMESCRIPT: (exec) => must(exec, "game.script").output,
  EXPORTGAME: (exec) => must(exec, "game.export").output,
  IMPORTGAME: (exec, _g, file) => must(exec, "game.import", { text: text(file) }).output,
  EXPORTPGN: (exec) => must(exec, "game.exportPgn").output,
  IMPORTPGN: (exec, _g, pgn) => must(exec, "game.importPgn", { text: text(pgn) }).output,
  SAVEGAME: (exec, _g, name) => must(exec, "game.save", { name: text(name) }).output,
  OPENGAME: (exec, _g, name) => must(exec, "game.open", { name: text(name) }).output,
  LISTGAMES: (exec) => stem(must(exec, "game.kept").output as string[]),
  FORGETGAME: (exec, _g, name) => must(exec, "game.forget", { name: text(name) }).output,
  GETTURN: (exec) => state(exec).turn,
  GETRESULT: (exec) => state(exec).result,
  PIECEAT: (_e, game, sq) => game.pieceAt(getIndexFromAlgebraic(square(sq, "PIECEAT"))),
  ISCHECK: (exec) => (state(exec).check ? 1 : 0),
  SETAIDIFFICULTY: (exec, _g, level) => must(exec, "ai.level", { level: text(level) }).output,
  GETAIDIFFICULTY: (exec) => state(exec).aiLevel,
  SETAISIDE: (exec, _g, side) => must(exec, "ai.side", { side: text(side) }).output,
  // In a page, the computer thinks in slices (think.ts), so a level-4 move
  // inside a control-bus request does not run into sae's limit for one
  // piece of work; the move is then made as ai.move's. With no timers (a
  // headless test) it is one call.
  AIMOVE: (exec, game) => {
    if (!canSlice() || game.isOver() || (game.book && bookMove(game) !== null)) return must(exec, "ai.move").output;
    return thinkOnce(game).then((move) => must(exec, "ai.move", move === null ? {} : { move }).output);
  },
  // The engine's search of the position, its line as both engines give it,
  // to compare them (TODO.md 4.4): the native one when this sae has it.
  ENGINE: () => (hasNative() ? "native" : "typescript"),
  AISEARCH: (_e, game, depth, engine) => {
    const d = depth === undefined || text(depth) === "" ? game.aiLevel : Number(depth);
    if (!Number.isInteger(d) || d < 1 || d > 6) throw new Error(`${text(depth)} is not a depth (1 to 6)`);
    if (game.isOver()) throw new Error(`the game is over (${game.status()}, ${game.result()})`);
    const which = engine === undefined || text(engine) === "" ? (hasNative() ? "native" : "typescript") : text(engine).trim().toLowerCase();
    if (which !== "native" && which !== "typescript") throw new Error(`${text(engine)} is not an engine (native or typescript)`);
    return (which === "native" ? searchNative(game, d) : searchTypescript(game, d)).then((l) => ({ ...l, best: l.best ?? "" }));
  },
  // A position's analysis as a stem: in a page, in slices (think.ts), as AIMOVE.
  ANALYZE: (exec, game, depth) => {
    const d = depth === undefined || text(depth) === "" ? {} : { depth: text(depth) };
    if (!canSlice() || game.isOver()) return analysisStem(must(exec, "ai.analyze", d).output as Analysis);
    const n = d.depth === undefined ? game.aiLevel : Number(d.depth);
    if (!LEVELS.includes(n)) throw new Error(`${d.depth} is not a depth (1 to 4)`);
    return analyzeOnce(game, n).then(analysisStem);
  },
  HINT: (exec, game) => {
    if (!canSlice() || game.isOver()) return must(exec, "ai.hint").output;
    return analyzeOnce(game, game.aiLevel).then((a) => a.best);
  },
  SETCLOCK: (exec, _g, control, white, black) => must(exec, "clock.set", {
    control: text(control) === "" ? "none" : text(control),
    ...(white === undefined || text(white) === "" ? {} : { white: text(white) }), ...(black === undefined || text(black) === "" ? {} : { black: text(black) }),
  }).output,
  GETCLOCK: (exec) => {
    const st = must(exec, "clock.state").output as ClockState | null;
    if (!st) return { control: "", white: "", black: "", running: "", flag: "", whiteText: "", blackText: "" };
    return { control: st.control, white: Math.round(st.white / 100) / 10, black: Math.round(st.black / 100) / 10, running: st.running, flag: st.flag, whiteText: timeText(st.white), blackText: timeText(st.black) };
  },
  LOADPUZZLE: (exec, _g, n) => must(exec, "puzzle.load", { n: text(n) === "" ? "1" : text(n) }).output,
  PUZZLESOLVED: (exec) => ((must(exec, "puzzle.state").output as PuzzleState | null)?.state === "solved" ? 1 : 0),
  GETPUZZLE: (exec) => {
    const st = must(exec, "puzzle.state").output as PuzzleState | null;
    return st ?? { index: 0, count: 0, title: "", goal: "", solver: "", left: 0, state: "", why: "" };
  },
  LISTPUZZLES: (exec) => stem(must(exec, "puzzle.list").output as string[]),
  IMPORTPUZZLES: (exec, _g, t) => must(exec, "puzzle.import", { text: text(t) }).output,
  OPENINGNAME: (exec) => state(exec).opening,
  BOOKMOVES: (_e, game) => stem(bookMoves(game)),
  SETBOOK: (exec, _g, on) => must(exec, "ai.book", on === undefined || text(on) === "" ? {} : { on: text(on) }).output,
  FLIPBOARD: (exec) => must(exec, "board.flip").output,
  BOARDSIZE: (exec, _g, px) => must(exec, "view.boardSize", px === undefined || text(px) === "" ? {} : text(px).trim().toLowerCase() === "fit" ? { fit: "1" } : { px: text(px) }).output,
  DARKMODE: (exec, _g, on) => must(exec, "view.dark", on === undefined || text(on) === "" ? {} : { on: text(on) }).output,
};

type Fn = (...args: any[]) => unknown;

// Every control function, for a script: those above, LISTCOMMANDS and
// BATCH_EXECUTE. `others` are the functions a script has besides
// (RUN_PROGRAM: script.ts), which LISTCOMMANDS lists and BATCH_EXECUTE
// calls too.
export function controlFunctions(exec: Exec, game: Game, others: Readonly<Record<string, Fn>>): Record<string, Fn> {
  const fns: Record<string, Fn> = {};
  for (const [name, fn] of Object.entries(CONTROL)) fns[name] = (...args: any[]) => fn(exec, game, ...args);
  const listed = [...new Set([...Object.keys(CONTROL), ...Object.keys(others), "LISTCOMMANDS", "BATCH_EXECUTE"])];
  // LISTCOMMANDS(): a stem of the names a script may call. LISTCOMMANDS(1):
  // each described (described.ts), {name, signature, params (a stem of
  // {name, type, optional, variadic, about}), does, gives}.
  fns.LISTCOMMANDS = (described?: unknown) => {
    if (!yes(described)) return stem(listed);
    return stem(listed.map((name) => {
      const d = DESCRIBED[name] ?? { params: [], does: "", gives: "" };
      const params = d.params.map((x) => ({ name: x.name, type: x.type, optional: x.optional ? 1 : 0, variadic: x.variadic ? 1 : 0, about: x.about ?? "" }));
      return { name, signature: signature(name, d), params: stem(params), does: d.does, gives: d.gives };
    }));
  };
  // [{command, args}, ...]: each run in turn, by any of these names; what
  // each gave or why it failed. `stop`: the first that fails is the whole
  // call's error, so a control-bus request made of it is taken back whole.
  fns.BATCH_EXECUTE = async (commands: unknown, stop?: unknown) => {
    const results: Record<string, unknown>[] = [];
    const halt = yes(stop);
    for (const [index, c] of (unstem(commands) as { command?: unknown; args?: unknown }[]).entries()) {
      const command = text(c.command).toUpperCase();
      const fn = fns[command] ?? others[command];
      if (!fn || command === "BATCH_EXECUTE") {
        if (halt) throw new Error(`command ${index + 1}: Unknown command: ${command}`);
        results.push({ index, command, success: false, error: `Unknown command: ${command}` });
        continue;
      }
      try {
        results.push({ index, command, success: true, result: await fn(...(Array.isArray(c.args) ? c.args : [])) });
      } catch (e) {
        if (halt) throw new Error(`command ${index + 1} (${command}): ${(e as Error).message}`);
        results.push({ index, command, success: false, error: (e as Error).message });
      }
    }
    return JSON.stringify(results);
  };
  return fns;
}
