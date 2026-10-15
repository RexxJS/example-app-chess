// app/chess/described.ts held to the functions themselves: every name
// LISTCOMMANDS() gives is described and nothing else is, each one's
// parameters are as many as it takes, and LISTCOMMANDS(1) gives them, as
// a program driving the app asks for them.
import { Commands } from "./chess/commands.ts";
import { CONTROL, controlFunctions } from "./chess/control.ts";
import { DESCRIBED, signature } from "./chess/described.ts";
import { eq } from "./lib/check.ts";

const cmds = new Commands();
// RUN_PROGRAM is script.ts's (2.4), given here as the "others" a script has.
const fns = controlFunctions((id, params) => cmds.execute(id, params), cmds.game, { RUN_PROGRAM: (_source: unknown, _encoding?: unknown) => "" });
const unstem = (s: Record<string, any>) => Array.from({ length: Number(s[0]) }, (_, i) => s[i + 1]);

const names: string[] = unstem(fns.LISTCOMMANDS());
eq("LISTCOMMANDS() lists every function, about thirty", names.length >= 28, true);
eq("every name it lists is described", names.filter((n) => !DESCRIBED[n]), []);
eq("and nothing is described that it does not list", Object.keys(DESCRIBED).filter((n) => !names.includes(n)), []);

// The parameters a function takes, by its length: a control function's
// first two are `exec` and the game, which a script never gives.
const fixed = (name: string) => DESCRIBED[name].params.filter((x) => !x.variadic).length;
const takes: Record<string, number> = {};
for (const [name, f] of Object.entries(CONTROL)) takes[name] = Math.max(0, f.length - 2);
takes.LISTCOMMANDS = fns.LISTCOMMANDS.length;
takes.BATCH_EXECUTE = fns.BATCH_EXECUTE.length;
takes.RUN_PROGRAM = 2;
eq("each one's parameters are as many as it takes", Object.keys(takes).filter((n) => DESCRIBED[n] && fixed(n) !== takes[n]).map((n) => `${n}: ${fixed(n)} described, takes ${takes[n]}`), []);
eq("none takes the rest of its arguments", Object.keys(DESCRIBED).filter((n) => DESCRIBED[n].params.some((x) => x.variadic)), []);
const TYPES = ["square", "san", "fen", "piece", "side", "level", "text", "number", "flag", "json", "stem"];
eq("every parameter is of a kind described.ts names", Object.entries(DESCRIBED).flatMap(([n, d]) => d.params.filter((x) => !TYPES.includes(x.type)).map((x) => `${n}.${x.name}`)), []);
eq("and every function says what it does and gives", Object.entries(DESCRIBED).filter(([, d]) => !d.does || !d.gives).map(([n]) => n), []);
eq("optional parameters come last", Object.entries(DESCRIBED).filter(([, d]) => d.params.some((x, i) => x.optional && d.params.slice(i + 1).some((y) => !y.optional))).map(([n]) => n), []);

const described: Record<string, any>[] = unstem(fns.LISTCOMMANDS(1));
eq("LISTCOMMANDS(1) describes each name LISTCOMMANDS() gives, in its order", described.map((d) => d.name), names);
const move = described.find((d) => d.name === "MOVE")!;
eq("each with its signature, what it does and gives", [move.signature, move.does, move.gives], ["MOVE(from, to, [promotion])", "Makes a move, from a square to a square, for the side to move", "the move in SAN, e.g. \"Nf3\" or \"e8=Q+\""]);
eq("its parameters a stem, typed, the optional one said so", unstem(move.params).map((x: any) => [x.name, x.type, x.optional, x.about]), [["from", "square", 0, ""], ["to", "square", 0, ""], ["promotion", "piece", 1, "queen if left out, when the move promotes"]]);
eq("a signature with no parameters", signature("GETBOARD", DESCRIBED.GETBOARD), "GETBOARD()");
eq("LISTCOMMANDS(0) is the names, as before", unstem(fns.LISTCOMMANDS(0)), names);
eq("asking changes nothing: no step of undo", cmds.game.canUndo(), false);

// expect: ok LISTCOMMANDS() lists every function, about thirty
// expect: ok every name it lists is described
// expect: ok and nothing is described that it does not list
// expect: ok each one's parameters are as many as it takes
// expect: ok none takes the rest of its arguments
// expect: ok every parameter is of a kind described.ts names
// expect: ok and every function says what it does and gives
// expect: ok optional parameters come last
// expect: ok LISTCOMMANDS(1) describes each name LISTCOMMANDS() gives, in its order
// expect: ok each with its signature, what it does and gives
// expect: ok its parameters a stem, typed, the optional one said so
// expect: ok a signature with no parameters
// expect: ok LISTCOMMANDS(0) is the names, as before
// expect: ok asking changes nothing: no step of undo
