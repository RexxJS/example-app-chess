// app/chess/ai.ts: the computer player. The QUnit "AI" case (a move from
// the start), the evaluation (the start is level, a pawn up is a pawn, the
// bishop pair), mate in one and a free queen found at level 2 for either
// side, stalemate avoided by the side ahead, no move when there is none,
// and the same move and the same count of positions evaluated each time
// at a level.
import { Position } from "./chess/position.ts";
import { fromFen } from "./chess/parser.ts";
import { AI, Thinking, depthOf, evaluate, evaluateMaterial, getMobilityValue } from "./chess/ai.ts";
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

// Thinking in slices (4.2): the same move as all at once, a root move or
// so a slice; a hard deadline gives up the depth in progress and keeps the
// one before; the position is as it was after any of it.
const sliced = (fen: string, depth: number) => {
  const t = new Thinking(fromFen(fen), depth);
  let slices = 0;
  while (!t.step(0)) slices++;
  return [t.best?.getCoordinate(), t.reached, slices > depth];
};
eq("in slices, the same move as all at once", sliced(kiwi, 3), [ai.search(fromFen(kiwi), 3)?.getCoordinate(), 3, true]);
eq("and from the start at level 4", sliced("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", 4)[0], ai.search(new Position(), 4)?.getCoordinate());
eq("its progress: the depth, the root move, of how many", (() => {
  const t = new Thinking(new Position(), 2);
  t.step(0);
  const a = t.progress();
  t.step(0);
  return [a, t.progress(), t.reached];
})(), [{ depth: 1, move: 1, of: 20 }, { depth: 1, move: 2, of: 20 }, 0]);
eq("past a hard deadline: cut short, the move of a depth done, the position back", (() => {
  const p = fromFen(kiwi);
  const key = p.hashKey.dup();
  const t = new Thinking(p, 4);
  while (t.reached < 1) t.step(0);
  t.step(Infinity, 0);
  return [t.done, t.cut, t.reached < 4, t.best !== null, p.hashKey.isEqual(key), p.getMadeMoveCount()];
})(), [true, true, true, true, true, 0]);
eq("stop: done, with the best so far", (() => {
  const t = new Thinking(new Position(), 4);
  while (t.reached < 2) t.step(0);
  t.stop();
  return [t.step(), t.reached, t.best?.getCoordinate()];
})(), [true, 2, ai.search(new Position(), 2)?.getCoordinate()]);
eq("no move to think about when mated", (() => {
  const t = new Thinking(fromFen("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1"), 3);
  return [t.done, t.step(), t.best];
})(), [true, true, null]);

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
eq("ai.move with the move a search chose", [c.run(`ai.move move=${c.game.legalMoves()[0].getCoordinate()}`).message.startsWith("the computer (white, level 1) played"), c.run("ai.move move=e8e4").message], [true, "e8e4 is not a legal move for black"]);
eq("a game's copy of its position, with its history", [c.game.positionCopy().getMadeMoveCount(), c.game.positionCopy().hashKey.isEqual(c.game.position.hashKey)], [5, true]);
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
// expect: ok in slices, the same move as all at once
// expect: ok and from the start at level 4
// expect: ok its progress: the depth, the root move, of how many
// expect: ok past a hard deadline: cut short, the move of a depth done, the position back
// expect: ok stop: done, with the best so far
// expect: ok no move to think about when mated
// expect: ok ai.move plays both sides, a step each
// expect: ok and the journal replays it
// expect: ok ai.move with the move a search chose
// expect: ok a game's copy of its position, with its history
// expect: ok no ai.move after mate
