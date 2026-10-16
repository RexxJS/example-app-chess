// The page's glue to the engine in Aether (app/chess/think.ts, TODO.md
// 4.4): what natives.engine.search is given (the depth, the seed, the
// game's start and its moves, so it sees the game's repetitions) and how
// its answer is read; with no native engine (here, as on sae's own build)
// the TypeScript one searches and ENGINE() says so; with one handed over
// (a stand-in here; the app's own sae in spec_app_chess_native), AIMOVE and
// AISEARCH ask it. The two engines' agreement is chess_native_reference's
// and tests/native/check.sh's.
import { Commands } from "./chess/commands.ts";
import { controlFunctions } from "./chess/control.ts";
import { hasNative, lineOf, nativeArg, searchTypescript, thinkOnce, useNative } from "./chess/think.ts";
import { Game } from "./chess/game.ts";
import { eq, throws } from "./lib/check.ts";

const g = new Game();
g.move(g.find("e4")!);
g.move(g.find("e5")!);
eq("what the native search is given", nativeArg(g, 4), "4|0|rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1|e2e4 e7e5");
eq("its answer read", lineOf("best=g1f3 value=0 reached=4 ties=2 nodes=2272 evaluations=1613"), { best: "g1f3", value: 0, reached: 4, ties: 2, nodes: 2272, evaluations: 1613, engine: "native" });
eq("no move", lineOf("best=none value=0 reached=0 ties=0 nodes=0 evaluations=0").best, null);
throws("an answer that is no line", () => lineOf("error"), Error, "the native engine said error");

const c = new Commands();
const fns = controlFunctions((id, params) => c.execute(id, params), c.game, {});
eq("no native engine here: ENGINE() is typescript", [hasNative(), fns.ENGINE()], [false, "typescript"]);
let line: any = null;
(fns.AISEARCH(4) as Promise<any>).then((l) => { line = l; });
// A promise's then runs after this script's turn; the TypeScript search with no timers is done at once.
Promise.resolve().then(() => Promise.resolve()).then(() => {
  eq("AISEARCH(4) from the start, the TypeScript engine: chess_native_reference's first line", line, { best: "g1f3", value: 0, reached: 4, ties: 2, nodes: 2272, evaluations: 1613, engine: "typescript" });
});
let direct: any = null;
searchTypescript(new Game(), 1).then((l) => { direct = l; });
throws("AISEARCH of an engine that is none", () => fns.AISEARCH(2, "fast"), Error, "fast is not an engine (native or typescript)");

// A native engine handed over (a stand-in): AIMOVE's search asks it, with the game's moves.
const asked: string[] = [];
useNative((arg) => {
  asked.push(arg);
  return Promise.resolve("best=d2d4 value=12 reached=2 ties=1 nodes=99 evaluations=80");
});
let moved: string | null = "";
thinkOnce(c.game).then((m) => { moved = m; });
Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve()).then(() => {
  eq("with one: ENGINE() native, and the computer's move is its", [fns.ENGINE(), moved, asked], ["native", "d2d4", ["2|0|rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1|"]]);
  eq("searchTypescript at depth 1: one depth done", direct.reached, 1);
  useNative(null);
});

// expect: ok what the native search is given
// expect: ok its answer read
// expect: ok no move
// expect: ok an answer that is no line
// expect: ok no native engine here: ENGINE() is typescript
// expect: ok AISEARCH of an engine that is none
// expect: ok AISEARCH(4) from the start, the TypeScript engine: chess_native_reference's first line
// expect: ok with one: ENGINE() native, and the computer's move is its
// expect: ok searchTypescript at depth 1: one depth done
