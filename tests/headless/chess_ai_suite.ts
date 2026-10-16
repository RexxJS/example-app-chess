// The computer player's strength (TODO.md 4.3): a suite of positions, each
// with the move expected at each level (or the levels that are too
// shallow to see it, and what they must not play); a mate in two checked
// against an oracle that tries every line; a nearer mate before a further
// one; and the choice among equal moves, by the seed, the same each time.
// The ordering's node counts, the exchanges and the phase are in
// chess_ai_ordering (saejs gives one file 10 s).
import { Position } from "./chess/position.ts";
import { fromFen } from "./chess/parser.ts";
import { AI, MATE_VALUE, Thinking, isMateValue } from "./chess/ai.ts";
import { eq } from "./lib/check.ts";

const ai = new AI();
const think = (fen: string, level: number, seed = 0): Thinking => {
  const t = new Thinking(fromFen(fen), level, ai, seed);
  t.step();
  return t;
};
const moves = (fen: string) => [1, 2, 3, 4].map((l) => think(fen, l).best?.getCoordinate());

// ---- the suite: what each level plays

eq("back-rank mate in one, every level", moves("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"), ["a1a8", "a1a8", "a1a8", "a1a8"]);
eq("the scholar's mate, every level", moves("r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"), ["h5f7", "h5f7", "h5f7", "h5f7"]);
eq("a smothered mate, every level", moves("6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1"), ["g5f7", "g5f7", "g5f7", "g5f7"]);
eq("the scholar's mate stopped, every level (Nf6 shuts the queen's file)", moves("rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 3 3"), ["g8f6", "g8f6", "g8f6", "g8f6"]);
eq("a loose queen taken, every level", moves("4k3/p7/8/3q4/8/4N3/P7/4K3 w - - 0 1"), ["e3d5", "e3d5", "e3d5", "e3d5"]);
eq("a pawn promoted to a queen, every level", moves("8/P6k/8/8/8/8/8/K7 w - - 0 1"), ["a7a8q", "a7a8q", "a7a8q", "a7a8q"]);
const fork = moves("4k3/p7/8/1q6/2N5/8/P7/4K3 w - - 0 1");
eq("a knight's fork of king and queen, from level 2 (level 1 sees only the knight attacked)", [fork[0] !== "c4d6", ...fork.slice(1)], [true, "c4d6", "c4d6", "c4d6"]);
const skewer = moves("7R/8/8/3k4/8/8/3q4/K7 w - - 0 1");
eq("a skewer, king then queen on the file, from level 2", skewer.slice(1), ["h8d8", "h8d8", "h8d8"]);
eq("a pawn the queen must not take (a pawn defends it), no level", moves("4k3/8/3p4/4p3/8/8/7Q/4K3 w - - 0 1").includes("h2e5"), false);

// ---- a mate in two, against an oracle

// Every legal move of the side to move.
const legal = (p: Position) => p.getMoves();
const mated = (p: Position) => legal(p).length === 0 && p.isKingInCheck();
const mateInOne = (p: Position) => legal(p).some((m) => {
  p.makeMove(m);
  const yes = mated(p);
  p.unmakeMove();
  return yes;
});
// The moves that mate in two at most: whatever the reply, a mate follows.
const mateInTwo = (p: Position): string[] => legal(p).filter((m) => {
  p.makeMove(m);
  const replies = legal(p);
  const yes = mated(p) || (replies.length > 0 && replies.every((r) => {
    p.makeMove(r);
    const y = mateInOne(p);
    p.unmakeMove();
    return y;
  }));
  p.unmakeMove();
  return yes;
}).map((m) => m.getCoordinate());
const ladder = "7k/8/8/8/8/8/R7/1R4K1 w - - 0 1";
const oracle = mateInTwo(fromFen(ladder));
eq("the oracle: a rook ladder has mates in two, and none in one", [oracle.length > 0, mateInOne(fromFen(ladder))], [true, false]);
eq("level 3 finds one of them, and knows it mates in three half-moves", [oracle.includes(think(ladder, 3).best!.getCoordinate()), think(ladder, 3).bestValue], [true, MATE_VALUE - 3]);
eq("and level 4", oracle.includes(think(ladder, 4).best!.getCoordinate()), true);
eq("level 2 cannot see so far", isMateValue(think(ladder, 2).bestValue), false);
const twoRooks = "6k1/5ppp/8/8/8/8/1R6/R5K1 w - - 0 1";
eq("a mate in one before a mate in two, at level 4 (the nearer mate is worth more)", (() => {
  const t = think(twoRooks, 4);
  const p = fromFen(twoRooks);
  p.makeMove(t.best!);
  return [mated(p), t.bestValue, ["a1a8", "b2b8"].includes(t.best!.getCoordinate())];
})(), [true, MATE_VALUE - 1, true]);
eq("a mate's value: MATE_VALUE less the half-moves to it", think("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", 2).bestValue, MATE_VALUE - 1);

// ---- equal moves, chosen by the seed

const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const chosen = [0, 1, 2, 3, 4, 5, 6, 7].map((seed) => think(start, 1, seed));
eq("at level 1 from the start, two knight moves are as good as each other", chosen[0].ties.map((m) => m.getCoordinate()).sort(), ["b1c3", "g1f3"]);
eq("the seed chooses between them, each seed the same each time", [new Set(chosen.map((t) => t.best!.getCoordinate())).size, think(start, 1, 3).best!.getCoordinate() === chosen[3].best!.getCoordinate()], [2, true]);
eq("and the choice is always one of the equal moves", chosen.every((t) => t.ties.some((m) => m === t.best)), true);

// expect: ok back-rank mate in one, every level
// expect: ok the scholar's mate, every level
// expect: ok a smothered mate, every level
// expect: ok the scholar's mate stopped, every level (Nf6 shuts the queen's file)
// expect: ok a loose queen taken, every level
// expect: ok a pawn promoted to a queen, every level
// expect: ok a knight's fork of king and queen, from level 2 (level 1 sees only the knight attacked)
// expect: ok a skewer, king then queen on the file, from level 2
// expect: ok a pawn the queen must not take (a pawn defends it), no level
// expect: ok the oracle: a rook ladder has mates in two, and none in one
// expect: ok level 3 finds one of them, and knows it mates in three half-moves
// expect: ok and level 4
// expect: ok level 2 cannot see so far
// expect: ok a mate in one before a mate in two, at level 4 (the nearer mate is worth more)
// expect: ok a mate's value: MATE_VALUE less the half-moves to it
// expect: ok at level 1 from the start, two knight moves are as good as each other
// expect: ok the seed chooses between them, each seed the same each time
// expect: ok and the choice is always one of the equal moves
