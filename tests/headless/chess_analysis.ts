// app/chess/analysis.ts (TODO.md 4.5): what the computer makes of a
// position: its value as a person reads it, a mate in so many moves for
// either side, the best move and the principal variation in SAN, numbered
// from the game's move; the ai.analyze and ai.hint commands (the game not
// changed, nothing journaled); ANALYZE() and HINT() in REXX; a hint is the
// move the computer would play.
import { Commands } from "./chess/commands.ts";
import { controlFunctions } from "./chess/control.ts";
import { MATE_VALUE } from "./chess/ai.ts";
import { analyze, lineText, valueText } from "./chess/analysis.ts";
import { Game } from "./chess/game.ts";
import { eq, throws } from "./lib/check.ts";

eq("the value as text: pawns with a sign, or a mate", [valueText(35, 0), valueText(-120, 0), valueText(0, 0), valueText(MATE_VALUE - 3, 2), valueText(-(MATE_VALUE - 1), -1)], ["+0.35", "-1.20", "0.00", "#2", "#-1"]);

const scholar = new Game("r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4");
const s = analyze(scholar, 2);
eq("white mates in one: the move, the line, the value", [s.mate, s.text, s.best, s.coordinate, s.pv, s.value], [1, "#1", "Qxf7#", "h5f7", ["Qxf7#"], MATE_VALUE - 1]);
eq("numbered from the game's move", lineText(scholar, s.pv), "4. Qxf7#");
const black = analyze(new Game("r5k1/8/8/8/8/8/5PPP/6K1 b - - 0 1"), 2);
eq("black mates in one: below 0", [black.mate, black.text, black.best, black.value < 0], [-1, "#-1", "Ra1#", true]);
const ladder = analyze(new Game("7k/8/8/8/8/8/R7/1R4K1 w - - 0 1"), 3);
eq("a mate in two, seen at depth 3: the whole line", [ladder.mate, ladder.text, ladder.pv.length, ladder.pv[2]?.endsWith("#")], [2, "#2", 3, true]);

// From the start: a line of legal moves, as deep as the search.
const start = new Game();
const a = analyze(start, 3);
eq("from the start at depth 3: three moves of line, the best first", [a.depth, a.pv.length, a.pv[0] === a.best, a.nodes > 0], [3, 3, true, true]);
eq("each move of it legal in turn", (() => {
  const g = new Game();
  return a.pv.every((san) => {
    const m = g.find(san);
    if (m) g.move(m);
    return !!m;
  });
})(), true);
eq("its text, white first: 1. x y 2. z", /^1\. \S+ \S+ 2\. \S+$/.test(lineText(start, a.pv)), true);
const afterE4 = new Game();
afterE4.move(afterE4.find("e4")!);
eq("black to move: 1... first", lineText(afterE4, ["e5", "Nf3", "Nc6"]), "1... e5 2. Nf3 Nc6");
eq("the value is near level at the start (within a pawn)", Math.abs(a.value) < 100, true);
eq("a pawn up, the value says so", analyze(new Game("4k3/4p3/8/8/8/8/3PP3/4K3 w - - 0 1"), 2).value > 50, true);

// The commands: nothing changed, nothing journaled.
const c = new Commands();
c.run("ai.level level=2");
const before = [c.game.fen(), c.journal().length];
const o = c.run("ai.analyze depth=3");
eq("ai.analyze: its message, the analysis as output", [o.ok, o.message.startsWith(`${(o.output as any).text} at depth 3: 1. `)], [true, true]);
eq("the game as it was, nothing journaled", [c.game.fen(), c.journal().length], before);
eq("a depth that is none", c.run("ai.analyze depth=9").message, "9 is not a depth (1 to 4)");
const hint = c.run("ai.hint");
eq("ai.hint: the move, said", [hint.message.startsWith(`hint: ${hint.output} (`)], [true]);
eq("a hint is the move the computer plays at its level", c.run("ai.move").output, hint.output);
c.run("game.undo");

// REXX: ANALYZE() and HINT().
const fns = controlFunctions((id, params) => c.execute(id, params), c.game, {});
const r = fns.ANALYZE(2) as any;
eq("ANALYZE(depth): a stem, the line a stem in it", [r.depth, r.pv[0], r.pv[1] === r.best, typeof r.value, r.mate, typeof r.text, r.coordinate.length], [2, 2, true, "number", 0, "string", 4]);
eq("ANALYZE() at the computer's level", (fns.ANALYZE() as any).depth, 2);
eq("HINT()", fns.HINT(), hint.output);
throws("ANALYZE with a depth that is none", () => fns.ANALYZE(7), Error, "7 is not a depth (1 to 4)");
c.run("game.setPosition fen=\"R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1\"");
throws("no analysis once the game is over", () => fns.ANALYZE(), Error, "the game is over (checkmate, 1-0)");

// expect: ok the value as text: pawns with a sign, or a mate
// expect: ok white mates in one: the move, the line, the value
// expect: ok numbered from the game's move
// expect: ok black mates in one: below 0
// expect: ok a mate in two, seen at depth 3: the whole line
// expect: ok from the start at depth 3: three moves of line, the best first
// expect: ok each move of it legal in turn
// expect: ok its text, white first: 1. x y 2. z
// expect: ok black to move: 1... first
// expect: ok the value is near level at the start (within a pawn)
// expect: ok a pawn up, the value says so
// expect: ok ai.analyze: its message, the analysis as output
// expect: ok the game as it was, nothing journaled
// expect: ok a depth that is none
// expect: ok ai.hint: the move, said
// expect: ok a hint is the move the computer plays at its level
// expect: ok ANALYZE(depth): a stem, the line a stem in it
// expect: ok ANALYZE() at the computer's level
// expect: ok HINT()
// expect: ok ANALYZE with a depth that is none
// expect: ok no analysis once the game is over
