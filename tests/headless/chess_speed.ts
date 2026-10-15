// Speed on QuickJS, measured: perft 4 from the start (197281 leaves) and
// perft 3 from Kiwipete (97862), each timed and held to a budget an order
// of magnitude over what this machine does, so a slower lowering or
// engine shows as a failure here and not as a sluggish app. Measured
// 2026-10-15 on an Apple Silicon Mac, sae's QuickJS, three runs: perft 4
// from the start 3.0-3.1 s (about 64 k leaves/s), Kiwipete perft 3
// 1.84-1.90 s (about 53 k leaves/s); the budgets are 60 s and 30 s, and
// 5 k leaves a second. The AI's depth-3 search joins this file
// when ai.ts is ported (TODO.md 4.1).
import { Position } from "./chess/position.ts";
import { fromFen } from "./chess/parser.ts";
import { eq } from "./lib/check.ts";

const timed = (f: () => number): [number, number] => {
  const t0 = Date.now();
  const n = f();
  return [n, Date.now() - t0];
};

const [startNodes, startMs] = timed(() => new Position().perft(4));
eq("perft 4 from the start: 197281 leaves, within 60 s", [startNodes, startMs < 60000], [197281, true]);
eq("and at over 5 k leaves a second", startNodes / (startMs / 1000) > 5000, true);

const [kiwiNodes, kiwiMs] = timed(() => fromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1").perft(3));
eq("Kiwipete perft 3: 97862 leaves, within 30 s", [kiwiNodes, kiwiMs < 30000], [97862, true]);
eq("and at over 5 k leaves a second", kiwiNodes / (kiwiMs / 1000) > 5000, true);

// expect: ok perft 4 from the start: 197281 leaves, within 60 s
// expect: ok and at over 5 k leaves a second
// expect: ok Kiwipete perft 3: 97862 leaves, within 30 s
// expect: ok and at over 5 k leaves a second
