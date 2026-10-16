// RexxJS scripts that drive the game, as the old app's in-app execution and
// iframe bus did: ADDRESS CHESS sends a command line and sets RC (0, or 1
// when refused, 2 for a command there is none of) and RESULT (what it
// gave); the control functions (control.ts: MOVE, GETBOARD, ...) are there
// by name, with LISTCOMMANDS, BATCH_EXECUTE and RUN_PROGRAM. The old 12
// commands (CHESS_COMMANDS.md: "move from=e2 to=e4", "get-board", ...) work
// as they were, each mapped to its function, a JSON answer where the old
// gave JSON; a command line of commands.ts ("game.move san=Nf3") works too.
// Each script runs on an interpreter of its own.
import type { Outcome } from "./commands.ts";
import { parseLine } from "./line.ts";
import { controlFunctions } from "./control.ts";
import type { Game } from "./game.ts";
import { RexxInterpreter, parse } from "./rexxjs.js";

export type { Outcome };

// What a script reaches: the commands, and the game to read.
export interface ScriptHost {
  readonly game: Game;
  run(line: string): Outcome;
  execute(id: string, params: Record<string, string>): Outcome;
}

const lastLine = (e: unknown): string => String((e as Error)?.message ?? e).split("\n").pop()!;

export async function runScript(text: string, host: ScriptHost, say: (line: string) => void): Promise<Outcome> {
  try {
    await interpreterFor(host, say)().run(parse(text));
    return { ok: true, message: "ran" };
  } catch (e) {
    return { ok: false, message: lastLine(e) };
  }
}

// One string as the control bus sends it (MOVE("e2", "e4")), REXX worked
// out on an interpreter of its own: what it came to, or why it failed.
// What the page serves on sae's control bus (sae/docs/control-bus.md).
export async function runChess(code: string, host: ScriptHost, say: (line: string) => void): Promise<Outcome> {
  try {
    const one = interpreterFor(host, say)();
    await one.run(parse(`LET RESULT = ${String(code).trim()}`));
    return { ok: true, message: "ran", output: one.getVariable("RESULT") };
  } catch (e) {
    return { ok: false, message: lastLine(e) };
  }
}

// The old app's command names (CHESS_COMMANDS.md), each as the function it
// is now, and whether the old gave its answer as JSON text.
export const OLD: Readonly<Record<string, { fn: string; json: boolean; args?: (p: Record<string, string>) => unknown[] }>> = {
  "move": { fn: "MOVE", json: false, args: (p) => [p.from, p.to, p.promotion] },
  "get-board": { fn: "GETBOARD", json: false },
  "get-moves": { fn: "GETMOVES", json: true },
  "list-legal-moves": { fn: "LISTLEGALMOVES", json: true },
  "undo": { fn: "UNDO", json: false },
  "redo": { fn: "REDO", json: false },
  "new-game": { fn: "NEWGAME", json: false },
  "set-ai-difficulty": { fn: "SETAIDIFFICULTY", json: false, args: (p) => [p.level] },
  "get-status": { fn: "GETSTATUS", json: true },
  "get-move-history": { fn: "GETMOVEHISTORY", json: true },
  "get-position-fen": { fn: "GETFEN", json: false },
  "get-game-info": { fn: "GETGAMEINFO", json: true },
};

// A stem ({0: n, 1: ..}) as a JSON array, all the way down, for the old
// commands' JSON answers.
function plain(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(plain);
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const n = Number(o[0]);
    if ("0" in o && Number.isInteger(n) && n >= 0 && Array.from({ length: n }, (_, i) => String(i + 1) in o).every(Boolean)) return Array.from({ length: n }, (_, i) => plain(o[i + 1]));
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

// A maker of interpreters with the control functions and ADDRESS CHESS.
function interpreterFor(host: ScriptHost, say: (line: string) => void): () => any {
  // One ADDRESS CHESS line: an old command ("move from=e2 to=e4"), or a
  // commands.ts line ("game.move san=Nf3"); RC 2 for none of either.
  const addressChess = async (line: string): Promise<{ success: boolean; errorCode: number; errorMessage?: string; output: unknown }> => {
    const { id, params } = parseLine(line.trim());
    const old = OLD[id.toLowerCase()];
    try {
      if (old) {
        const args = (old.args ? old.args(params) : []).filter((a) => a !== undefined);
        if (id.toLowerCase() === "move" && (params.from === undefined || params.to === undefined)) throw new Error("from and to parameters required (e.g., from=e2 to=e4)");
        if (id.toLowerCase() === "set-ai-difficulty" && params.level === undefined) throw new Error("level parameter required (1-4)");
        const got = await functions[old.fn](...args);
        return { success: true, errorCode: 0, output: old.json ? JSON.stringify(plain(got)) : got };
      }
      const o = host.run(line.trim());
      if (!o.ok && o.message === `no command ${id}`) return { success: false, errorCode: 2, errorMessage: `Unknown command: ${id}`, output: `Unknown command: ${id}` };
      return { success: o.ok, errorCode: o.ok ? 0 : 1, errorMessage: o.ok ? undefined : o.message, output: o.output ?? o.message };
    } catch (e) {
      return { success: false, errorCode: 1, errorMessage: lastLine(e), output: lastLine(e) };
    }
  };
  const own = {
    // An ADDRESS CHESS line as a function, for the control bus (whose
    // requests are expressions): what the line gave, or its refusal as the
    // error. rexx/chess-address.js sends a line that is no call this way.
    CHESSCOMMAND: async (line: unknown) => {
      const r = await addressChess(String(line ?? ""));
      if (!r.success) throw new Error(r.errorMessage ?? String(r.output));
      return r.output;
    },
    // A whole program (lines, loops, routines), run on an interpreter of its
    // own with these same functions: what it SAYs, and its RESULT. Inside a
    // control-bus request it is the request, so one step of undo, and taken
    // back whole if it fails or sae stops it. `encoding` "json": `source` is
    // a JSON string, as the MCP server sends a program (so nothing in it is
    // read as REXX on the way in).
    RUN_PROGRAM: async (source: unknown, encoding?: unknown) => {
      const text = String(encoding ?? "").toLowerCase() === "json" ? JSON.parse(String(source)) : String(source ?? "");
      if (typeof text !== "string") throw new Error("RUN_PROGRAM: the program must be text");
      const said: string[] = [];
      const one = interpreter((line) => {
        said.push(line);
        say(line);
      });
      await one.run(parse(text));
      const result = one.getVariable("RESULT");
      return { said: Object.fromEntries([[0, said.length], ...said.map((l, i) => [i + 1, l])]), result: result ?? "" };
    },
  };
  const exec = (id: string, params: Record<string, string>) => host.execute(id, params);
  const functions = { ...own, ...controlFunctions(exec, host.game, own) };
  // `out`: where its SAY lines go (the script's own `say`, unless a
  // program run with RUN_PROGRAM collects them).
  const interpreter = (out: (line: string) => void = say) => {
    const it = new RexxInterpreter(null, { output: (line: unknown) => out(String(line)) });
    it.addressTargets.set("chess", {
      handler: (line: string) => addressChess(String(line)),
      methods: {},
      metadata: { name: "chess" },
    });
    install(it, functions);
    return it;
  };
  return interpreter;
}

// The functions a script calls by name, in place of any built-in of the
// same name (as the spreadsheet's rexx.ts installs its own).
export function install(it: any, functions: Record<string, (...args: any[]) => unknown>): void {
  for (const name of Object.keys(functions)) {
    delete it.builtInFunctions[name];
    delete it.builtInFunctions[`${name}_positional_args_to_named_param_map`];
  }
  Object.assign(it.externalFunctions, functions);
}
