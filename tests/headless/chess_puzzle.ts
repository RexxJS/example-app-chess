// app/chess/puzzle.ts (TODO.md 6.4): puzzles, a position and a goal (mate
// in n), checked: a set read from its text (and what is wrong with a bad
// one said), a puzzle loaded, the solver's moves checked against a mate
// search (a mate solves it; a move that lets the mate go, or the last move
// without mate, fails it, and Undo tries again), the computer's defence
// the one that holds out longest; puzzle.* commands, and LOADPUZZLE(),
// PUZZLESOLVED(), GETPUZZLE(), LISTPUZZLES(), IMPORTPUZZLES() in REXX. The
// app's own set is proved, puzzle by puzzle, in chess_puzzle_set.
import { Commands } from "./chess/commands.ts";
import { controlFunctions } from "./chess/control.ts";
import { SET, mateIn, parsePuzzles } from "./chess/puzzle.ts";
import { fromFen } from "./chess/parser.ts";
import { eq, throws } from "./lib/check.ts";

const set = parsePuzzles(SET);
eq("the app's set read: titles, goals", [set.length, set[0], set[4].mateIn], [10, { fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", mateIn: 1, title: "The back rank" }, 2]);
throws("a line with no goal", () => parsePuzzles("8/8/8/8/8/8/8/8 w"), Error, "puzzles, line 1: <FEN> ; mate in <n> ; <title>, not \"8/8/8/8/8/8/8/8 w\"");
throws("a goal that is not mate in n", () => parsePuzzles("# x\n6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1 ; win"), Error, "puzzles, line 2: the goal is \"mate in <n>\" (1 to 9), not \"win\"");
throws("a FEN that is no position", () => parsePuzzles("8/8/8/8/8/8/8/8 w - - 0 1 ; mate in 1"), Error, "puzzles, line 1: FEN: one king each, not 0 white and 0 black");
throws("no puzzles at all", () => parsePuzzles("# nothing\n"), Error, "puzzles: none in the text");
eq("a title left out is numbered", parsePuzzles("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1 ; mate in 1")[0].title, "Puzzle 1");
eq("mateIn: the ladder is a mate in 2, not in 1", [mateIn(fromFen("7k/8/8/8/8/8/R7/1R4K1 w - - 0 1"), 1), mateIn(fromFen("7k/8/8/8/8/8/R7/1R4K1 w - - 0 1"), 2)], [false, true]);

// Solving: the ladder, mate in 2.
const c = new Commands();
eq("puzzle.load: its position, its message", [c.run("puzzle.load n=5").message, c.game.fen()], ["puzzle 5 of 10, The rook ladder: white to play and mate in 2", "7k/8/8/8/8/8/R7/1R4K1 w - - 0 1"]);
eq("its state: solving, two moves left", c.run("puzzle.state").output, { index: 5, count: 10, title: "The rook ladder", goal: "mate in 2", solver: "white", left: 2, state: "solving", why: "" });
c.run("game.move san=Ra7");
eq("a right move: the computer defends at once, one move left", [c.game.sanList(), (c.run("puzzle.state").output as any).left, (c.run("puzzle.state").output as any).state], [["Ra7", "Kg8"], 1, "solving"]);
c.run("game.move san=Rb8#");
eq("mate: solved", [(c.run("puzzle.state").output as any).state, c.game.result()], ["solved", "1-0"]);

// A wrong move fails it; Undo tries again.
c.run("puzzle.load n=5");
c.run("game.move san=Rb8+");
eq("a check that lets the king out: failed, and why", c.run("puzzle.state").output, { index: 5, count: 10, title: "The rook ladder", goal: "mate in 2", solver: "white", left: 1, state: "failed", why: "after that the mate can be escaped: no forced mate in 1 more" });
eq("no defence made after a failure", c.game.sanList(), ["Rb8+"]);
c.run("game.undo");
eq("Undo: solving again, from the start", [(c.run("puzzle.state").output as any).state, (c.run("puzzle.state").output as any).left, c.game.made.length], ["solving", 2, 0]);
c.run("game.move san=Ra7");
c.run("game.undo");
eq("Undo after the defence: back to the solver's move, both taken back", [c.game.made.length, c.game.turn(), (c.run("puzzle.state").output as any).left], [0, "white", 2]);
c.run("game.move san=Ra7");
c.run("game.move san=Ra8+");
eq("the last move not mate: failed", (c.run("puzzle.state").output as any).why, "no mate in 2: the last move was not mate");

// Black solves; a new game leaves the puzzle.
c.run("puzzle.load n=7");
eq("black to play", (c.run("puzzle.state").output as any).solver, "black");
c.run("game.new");
eq("a new game leaves the puzzle", c.run("puzzle.state").output, null);
eq("a puzzle that is none", c.run("puzzle.load n=99").message, "99 is not a puzzle here (1 to 10)");

// REXX.
const r = new Commands();
const fns = controlFunctions((id, params) => r.execute(id, params), r.game, {});
eq("LISTPUZZLES(): a stem of titles and goals", [(fns.LISTPUZZLES() as any)[0], (fns.LISTPUZZLES() as any)[1]], [10, "The back rank (mate in 1)"]);
eq("LOADPUZZLE(1), MOVE, PUZZLESOLVED()", [fns.LOADPUZZLE(1), fns.PUZZLESOLVED(), fns.MOVE("a1", "a8"), fns.PUZZLESOLVED()], ["The back rank", 0, "Ra8#", 1]);
eq("GETPUZZLE(): solved", (fns.GETPUZZLE() as any).state, "solved");
eq("IMPORTPUZZLES(text): a set of one", [fns.IMPORTPUZZLES("6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1 ; mate in 1 ; Mine"), fns.LOADPUZZLE(1), (fns.GETPUZZLE() as any).count], [1, "Mine", 1]);
throws("IMPORTPUZZLES of no set", () => fns.IMPORTPUZZLES("bad"), Error, "puzzles, line 1: <FEN> ; mate in <n> ; <title>, not \"bad\"");
eq("GETPUZZLE() with none", (r.run("game.new"), (fns.GETPUZZLE() as any).index), 0);

// expect: ok the app's set read: titles, goals
// expect: ok a line with no goal
// expect: ok a goal that is not mate in n
// expect: ok a FEN that is no position
// expect: ok no puzzles at all
// expect: ok a title left out is numbered
// expect: ok mateIn: the ladder is a mate in 2, not in 1
// expect: ok puzzle.load: its position, its message
// expect: ok its state: solving, two moves left
// expect: ok a right move: the computer defends at once, one move left
// expect: ok mate: solved
// expect: ok a check that lets the king out: failed, and why
// expect: ok no defence made after a failure
// expect: ok Undo: solving again, from the start
// expect: ok Undo after the defence: back to the solver's move, both taken back
// expect: ok the last move not mate: failed
// expect: ok black to play
// expect: ok a new game leaves the puzzle
// expect: ok a puzzle that is none
// expect: ok LISTPUZZLES(): a stem of titles and goals
// expect: ok LOADPUZZLE(1), MOVE, PUZZLESOLVED()
// expect: ok GETPUZZLE(): solved
// expect: ok IMPORTPUZZLES(text): a set of one
// expect: ok IMPORTPUZZLES of no set
// expect: ok GETPUZZLE() with none
