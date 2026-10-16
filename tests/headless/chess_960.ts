// Chess960 (app/chess/chess960.ts and position.ts's castling, TODO.md 6.5):
// the 960 start positions enumerated by the standard numbering (each one a
// start position by the rules, all different, numbered back), perft on
// Chess960 positions from the published lists, castling as its rules have
// it (the king on to its rook, ending on g and f or c and d, whatever the
// squares; every square between empty; no square of the king's way
// attacked), X-FEN's castling field, the king named by where it ends; and
// game.new960, NEWGAME960(), CHESS960NUMBER().
import { Commands } from "./chess/commands.ts";
import { controlFunctions } from "./chess/control.ts";
import { backRank, fen960, number960 } from "./chess/chess960.ts";
import { START_FEN, fromFen, parseMove, toFen, toSan } from "./chess/parser.ts";
import { Game } from "./chess/game.ts";
import { eq, throws } from "./lib/check.ts";

// The 960.
const ranks: string[] = [];
for (let n = 0; n < 960; ++n) ranks.push(backRank(n));
const isStart = (r: string) => {
  const b = [...r].map((p, i) => (p === "B" ? i % 2 : -1)).filter((x) => x >= 0);
  const [r1, k, r2] = [r.indexOf("R"), r.indexOf("K"), r.lastIndexOf("R")];
  return [...r].sort().join("") === "BBKNNQRR" && b.length === 2 && b[0] !== b[1] && r1 < k && k < r2;
};
eq("960 back ranks, all different, each a start by the rules (bishops on both colours, the king between the rooks)", [new Set(ranks).size, ranks.every(isStart)], [960, true]);
eq("518 is the usual start; 0 and 959 the ends of the numbering", [backRank(518), backRank(0), backRank(959), fen960(518) === START_FEN], ["RNBQKBNR", "BBQNNRKR", "RKRNNQBB", true]);
eq("each numbered back from its FEN", ranks.every((_, n) => number960(fen960(n)) === n), true);
eq("a position that is no start: -1", [number960("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"), number960("BBNNQRRK")], [-1, -1]);
throws("a number that is none", () => backRank(960), Error, "960 is not a Chess960 position (0 to 959)");

// Perft, the move generator's oracle (positions and counts from the published Chess960 perft lists).
const perft = (fen: string, d: number) => fromFen(fen).perft(d);
eq("perft 1 to 3: bqnb1rkr/pp3ppp/... HFhf", [1, 2, 3].map((d) => perft("bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9", d)), [21, 528, 12189]);
eq("perft 1 to 3: 2nnrbkr/p1qppppp/... HEhe", [1, 2, 3].map((d) => perft("2nnrbkr/p1qppppp/8/1ppb4/6PP/3PP3/PPP2P2/BQNNRBKR w HEhe - 1 9", d)), [21, 807, 18002]);
eq("perft 3 from start position 0, as the usual rules' twin by mirror (959 is 0 mirrored a to h)", perft(fen960(0), 3), perft(fen960(959), 3));

// Castling.
const after = (fen: string, move: string) => {
  const p = fromFen(fen);
  const m = parseMove(p, move);
  if (!m) return "none";
  const san = toSan(p, m);
  p.makeMove(m);
  return `${san} ${toFen(p)}`;
};
const KB = "4k3/8/8/8/8/8/8/RK5R w KQ - 0 1";
eq("a king on b1: Chess960, its castling moves the king on to its rook", [fromFen(KB).chess960, fromFen(KB).getMoves().filter((m) => m.isCastle()).map((m) => m.getCoordinate()).sort()], [true, ["b1a1", "b1h1"]]);
eq("O-O-O: the king to c1 (to the right), the rook to d1", after(KB, "b1a1"), "O-O-O 4k3/8/8/8/8/8/8/2KR3R b - - 1 1");
eq("O-O: the king to g1, the rook to f1", after(KB, "O-O"), "O-O 4k3/8/8/8/8/8/8/R4RK1 b - - 1 1");
eq("the king named by where it ends: b1g1", after(KB, "b1g1"), "O-O 4k3/8/8/8/8/8/8/R4RK1 b - - 1 1");
eq("a king on g1 already: only the rook moves", after("4k3/8/8/8/8/8/8/6KR w K - 0 1", "g1h1"), "O-O 4k3/8/8/8/8/8/8/5RK1 b - - 1 1");
eq("king f1, rook g1: they change places", after("4k3/8/8/8/8/8/8/5KR1 w K - 0 1", "O-O"), "O-O 4k3/8/8/8/8/8/8/5RK1 b - - 1 1");
eq("a piece in the way: no castling either side", after("4k3/8/8/8/8/8/8/RKN4R w KQ - 0 1", "O-O-O") + " | " + after("4k3/8/8/8/8/8/8/RKN4R w KQ - 0 1", "O-O"), "none | none");
eq("a square of the king's way attacked: none", after("4k3/8/8/8/8/8/2r5/RK5R w KQ - 0 1", "O-O-O") + " | " + after("4k3/8/8/8/8/8/2r5/RK5R w KQ - 0 1", "O-O"), "none | none");
eq("in check: none", after("1r2k3/8/8/8/8/8/8/RK5R w KQ - 0 1", "O-O"), "none");
eq("taken back whole", (() => {
  const p = fromFen(KB);
  for (const m of p.getMoves()) {
    p.makeMove(m);
    p.unmakeMove();
  }
  return toFen(p);
})(), KB);
eq("a rook's move ends its side's right", after(KB, "h1h2").split(" ")[3], "Q");
eq("black castles too", after("rk5r/8/8/8/8/8/8/4K3 b kq - 0 1", "O-O"), "O-O r4rk1/8/8/8/8/8/8/4K3 w - - 1 2");

// X-FEN: KQkq for the outermost rooks, the file for another; Shredder-FEN's files read.
eq("Shredder-FEN read, written as X-FEN", toFen(fromFen("bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w HFhf - 2 9")), "bqnb1rkr/pp3ppp/3ppn2/2p5/5P2/P2P4/NPP1P1PP/BQ1BNRKR w KQkq - 2 9");
eq("an inner rook's right by its file", toFen(fromFen("4k3/8/8/8/8/8/8/R1R1K2R w KC - 0 1")), "4k3/8/8/8/8/8/8/R1R1K2R w KC - 0 1");
eq("a right with no rook there is dropped", toFen(fromFen("4k3/8/8/8/8/8/8/4K3 w KQ - 0 1")), "4k3/8/8/8/8/8/8/4K3 w - - 0 1");
eq("the usual start is not Chess960", fromFen(START_FEN).chess960, false);

// The game, the commands, REXX.
const c = new Commands();
eq("game.new960 n=0", [c.run("game.new960 n=0").output, c.game.chess960(), c.game.position.chess960], ["bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1", 0, true]);
eq("one at random: a start of the 960", (() => { c.run("game.new960"); const n = c.game.chess960(); return n >= 0 && n < 960; })(), true);
eq("a number that is none, refused", c.run("game.new960 n=1000").message, "1000 is not a Chess960 position (0 to 959)");
const g = new Game("rk5r/8/8/8/8/8/8/RK5R w KQkq - 0 1");
for (const san of ["O-O", "O-O-O"]) g.move(g.find(san)!);
eq("a game of it castles, and is written as PGN with its Variant and FEN", [g.sanList().join(" "), /\[Variant "Chess960"\]/.test(g.toPgn()), g.toPgn().includes("[FEN \"rk5r/8/8/8/8/8/8/RK5R w KQkq - 0 1\"]"), g.fen()], ["O-O O-O-O", true, true, "2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2"]);
const back = new Game();
back.fromPgn(g.toPgn());
eq("and read back from it", [back.sanList().join(" "), back.fen()], ["O-O O-O-O", "2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2"]);
const fns = controlFunctions((id, params) => c.execute(id, params), c.game, {});
eq("NEWGAME960(959), CHESS960NUMBER()", [fns.NEWGAME960(959), fns.CHESS960NUMBER()], ["rkrnnqbb/pppppppp/8/8/8/8/PPPPPPPP/RKRNNQBB w KQkq - 0 1", 959]);
eq("CHESS960NUMBER() of the usual game: 518", (fns.NEWGAME(), fns.CHESS960NUMBER()), 518);

// expect: ok 960 back ranks, all different, each a start by the rules (bishops on both colours, the king between the rooks)
// expect: ok 518 is the usual start; 0 and 959 the ends of the numbering
// expect: ok each numbered back from its FEN
// expect: ok a position that is no start: -1
// expect: ok a number that is none
// expect: ok perft 1 to 3: bqnb1rkr/pp3ppp/... HFhf
// expect: ok perft 1 to 3: 2nnrbkr/p1qppppp/... HEhe
// expect: ok perft 3 from start position 0, as the usual rules' twin by mirror (959 is 0 mirrored a to h)
// expect: ok a king on b1: Chess960, its castling moves the king on to its rook
// expect: ok O-O-O: the king to c1 (to the right), the rook to d1
// expect: ok O-O: the king to g1, the rook to f1
// expect: ok the king named by where it ends: b1g1
// expect: ok a king on g1 already: only the rook moves
// expect: ok king f1, rook g1: they change places
// expect: ok a piece in the way: no castling either side
// expect: ok a square of the king's way attacked: none
// expect: ok in check: none
// expect: ok taken back whole
// expect: ok a rook's move ends its side's right
// expect: ok black castles too
// expect: ok Shredder-FEN read, written as X-FEN
// expect: ok an inner rook's right by its file
// expect: ok a right with no rook there is dropped
// expect: ok the usual start is not Chess960
// expect: ok game.new960 n=0
// expect: ok one at random: a start of the 960
// expect: ok a number that is none, refused
// expect: ok a game of it castles, and is written as PGN with its Variant and FEN
// expect: ok and read back from it
// expect: ok NEWGAME960(959), CHESS960NUMBER()
// expect: ok CHESS960NUMBER() of the usual game: 518
