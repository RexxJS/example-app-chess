// The reference the native engine (native/engine.ae, TODO.md 4.4) is held
// to: the TypeScript engine's search on a suite of positions, each line
// what it gives (the move, its value to white, the depth reached, how many
// moves tied, the nodes searched and the positions evaluated). These
// "// expect:" lines are the verdicts twice over: here for ai.ts, and in
// tests/native/check.sh, which runs the native engine on the same suite
// (it reads the SUITE lines below) and wants the same lines, node for node.
import { fromFen } from "./chess/parser.ts";
import { AI, Thinking } from "./chess/ai.ts";

// fen, depth, seed: one an entry, as tests/native/check.sh reads them.
const SUITE: [string, number, number][] = [
  ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 4, 0],
  ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 1, 3],
  ["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", 3, 0],
  ["r2q1rk1/1b2bppp/p2ppn2/1p6/3NP3/1BN1B3/PPP2PPP/R2Q1RK1 w - - 0 11", 3, 0],
  ["7k/8/8/8/8/8/R7/1R4K1 w - - 0 1", 3, 0],
  ["4k3/8/3p4/4p3/8/8/7Q/4K3 w - - 0 1", 4, 0],
  ["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 4, 0],
  ["rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 3 3", 4, 0],
  ["r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", 4, 0],
  ["4k3/p7/8/1q6/2N5/8/P7/4K3 w - - 0 1", 3, 0],
  ["8/P6k/8/8/8/8/8/K7 w - - 0 1", 3, 0],
  ["R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1", 3, 0],
];

for (const [fen, depth, seed] of SUITE) {
  const ai = new AI();
  const t = new Thinking(fromFen(fen), depth, ai, seed);
  t.step();
  print(`best=${t.best ? t.best.getCoordinate() : "none"} value=${t.bestValue} reached=${t.reached} ties=${t.ties.length} nodes=${ai.nodes} evaluations=${ai.evaluations}`);
}

// expect: best=g1f3 value=0 reached=4 ties=2 nodes=2272 evaluations=1613
// expect: best=b1c3 value=52 reached=1 ties=2 nodes=20 evaluations=20
// expect: best=e2a6 value=99 reached=3 ties=1 nodes=5428 evaluations=5249
// expect: best=f2f3 value=350 reached=3 ties=1 nodes=5099 evaluations=4886
// expect: best=a2a7 value=19997 reached=3 ties=2 nodes=1105 evaluations=1008
// expect: best=h2h7 value=701 reached=4 ties=1 nodes=2838 evaluations=1820
// expect: best=b4f4 value=75 reached=4 ties=1 nodes=1184 evaluations=900
// expect: best=g8f6 value=36 reached=4 ties=1 nodes=4489 evaluations=3916
// expect: best=h5f7 value=19999 reached=1 ties=1 nodes=44 evaluations=43
// expect: best=c4d6 value=279 reached=3 ties=1 nodes=274 evaluations=226
// expect: best=a7a8q value=901 reached=3 ties=1 nodes=115 evaluations=96
// expect: best=none value=0 reached=0 ties=0 nodes=0 evaluations=0
