// app/chess/ai.ts: the computer player. The QUnit "AI" case (a move from
// the start), the evaluation (the start is level, a pawn up is a pawn, the
// bishop pair), mate in one and a free queen found at level 2 for either
// side, stalemate avoided by the side ahead, no move when there is none,
// and the same move and the same count of positions evaluated each time
// at a level.
import { Position } from "./chess/position.ts";
import { fromFen } from "./chess/parser.ts";
import { AI, depthOf, evaluate, evaluateMaterial, getMobilityValue } from "./chess/ai.ts";
import { PieceColor } from "./chess/chess.ts";
import { Commands } from "./chess/commands.ts";
import { eq } from "./lib/check.ts";

const ai = new AI();
const best = (fen: string, level: number) => ai.search(fromFen(fen), depthOf(level))?.getCoordinate() ?? null;

eq("QUnit AI: a move from the start", ai.search(new Position()) !== null, true);
eq("the start is level", [evaluate(new Position()), evaluateMaterial(new Position())], [0, 0]);
eq("a pawn up is a pawn of material", evaluateMaterial(fromFen("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1")), 100);
eq("the bishop pair is half a pawn more", evaluateMaterial(fromFen("4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1")) - 600, 50);
eq("mobility: twenty moves each at the start", [getMobilityValue(new Position(), PieceColor.WHITE), getMobilityValue(new Position(), PieceColor.BLACK)], [20, 20]);
eq("the levels are depths 1 to 4", [1, 2, 3, 4, 0, 9].map(depthOf), [1, 2, 3, 4, 1, 4]);

// Mate in one: a back-rank mate, for white and for black.
eq("mate in one at level 2, white", best("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", 2), "a1a8");
eq("mate in one at level 2, black", best("r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1", 2), "a8a1");
eq("and at levels 3 and 4", [best("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", 3), best("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", 4)].every((m) => m !== null), true);
// A queen left loose: the knight takes it.
eq("a free queen at level 2, white", best("4k3/8/8/3q4/8/4N3/8/4K3 w - - 0 1", 2), "e3d5");
eq("a free queen at level 2, black", best("4k3/8/4n3/8/3Q4/8/8/4K3 b - - 0 1", 2), "e6d4");
eq("and at level 1", best("4k3/8/8/3q4/8/4N3/8/4K3 w - - 0 1", 1), "e3d5");
// No move: mated, stalemated.
eq("no move when mated", ai.search(fromFen("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1"), 2), null);
eq("no move when stalemated", ai.search(fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), 2), null);
// Qf7 would stalemate; Qf8 mates.
eq("mate, not stalemate", best("7k/8/6K1/8/8/8/8/5Q2 w - - 0 1", 2), "f1f8");

// The same each time: the move and the positions evaluated.
const kiwi = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
const runs = [0, 1].map(() => {
  const m = ai.search(fromFen(kiwi), 3);
  return [m?.getCoordinate(), ai.evaluations];
});
eq("deterministic at a level: the same move, the same count", runs[0], runs[1]);
eq("the position is as it was after a search", (() => {
  const p = fromFen(kiwi);
  const key = p.hashKey.dup();
  ai.search(p, 3);
  return [p.hashKey.isEqual(key), p.getMadeMoveCount()];
})(), [true, 0]);

// ai.move: a game the computer plays both sides of, each move a step of undo.
const c = new Commands();
c.run("ai.level level=1");
const said = [1, 2, 3, 4].map(() => c.run("ai.move").output);
eq("ai.move plays both sides, a step each", [said.length, c.game.steps], [4, [1, 1, 1, 1]]);
eq("and the journal replays it", (() => {
  const again = new Commands();
  for (const line of c.journal()) again.run(line);
  return again.game.fen();
})(), c.game.fen());
c.run("game.setPosition fen=\"R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1\"");
eq("no ai.move after mate", c.run("ai.move").message, "the game is over (checkmate, 1-0)");

// expect: ok QUnit AI: a move from the start
// expect: ok the start is level
// expect: ok a pawn up is a pawn of material
// expect: ok the bishop pair is half a pawn more
// expect: ok mobility: twenty moves each at the start
// expect: ok the levels are depths 1 to 4
// expect: ok mate in one at level 2, white
// expect: ok mate in one at level 2, black
// expect: ok and at levels 3 and 4
// expect: ok a free queen at level 2, white
// expect: ok a free queen at level 2, black
// expect: ok and at level 1
// expect: ok no move when mated
// expect: ok no move when stalemated
// expect: ok mate, not stalemate
// expect: ok deterministic at a level: the same move, the same count
// expect: ok the position is as it was after a search
// expect: ok ai.move plays both sides, a step each
// expect: ok and the journal replays it
// expect: ok no ai.move after mate
