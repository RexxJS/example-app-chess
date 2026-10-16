// The computer player's speed on QuickJS (ai.ts), timed and held to
// budgets an order of magnitude over what this machine does, so a slower
// engine or lowering shows here. Measured 2026-10-16 on an Apple Silicon
// Mac, sae's QuickJS: level 3 from the start 45 ms, level 3 on Kiwipete
// 1.1 s, level 4 on a quiet middle game (a Sicilian, move 11) 2.2 s, about
// 10 k nodes a second; the 4.1 player (the old search, material and
// squares only) did level 4 on Kiwipete in 2.2 s, this one 4.1 s: its
// evaluation counts mobility and it orders its moves, which costs per node
// and saves nodes (chess_ai_suite). Level 4 on Kiwipete is timed by
// spec_app_chess_thinking, in slices: saejs gives one file 10 s.
import { Position } from "./chess/position.ts";
import { fromFen } from "./chess/parser.ts";
import { AI } from "./chess/ai.ts";
import { eq } from "./lib/check.ts";

const timed = (f: () => void): number => {
  const t0 = Date.now();
  f();
  return Date.now() - t0;
};
const ai = new AI();
const kiwipete = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const quiet = "r2q1rk1/1b2bppp/p2ppn2/1p6/3NP3/1BN1B3/PPP2PPP/R2Q1RK1 w - - 0 11";

eq("level 3 from the start, within 5 s", timed(() => ai.search(new Position(), 3)) < 5000, true);
eq("level 3 on Kiwipete, within 20 s", timed(() => ai.search(fromFen(kiwipete), 3)) < 20000, true);
const ms = timed(() => ai.search(fromFen(quiet), 4));
eq("level 4 on a quiet middle game, within 30 s", ms < 30000, true);
eq("at over 1 k nodes a second", ai.nodes / (ms / 1000) > 1000, true);

// expect: ok level 3 from the start, within 5 s
// expect: ok level 3 on Kiwipete, within 20 s
// expect: ok level 4 on a quiet middle game, within 30 s
// expect: ok at over 1 k nodes a second
