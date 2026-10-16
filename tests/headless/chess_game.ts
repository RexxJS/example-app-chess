// app/chess/game.ts: a game over a position. Moves made with their SAN,
// undo to the start and redo to the end, a new game clearing the lists, a
// position set from FEN, whose turn, the result (mate, resignation, a draw
// agreed), a group of moves as one step, and a snapshot restored whole.
import { Game, LEVELS } from "./chess/game.ts";
import { START_FEN } from "./chess/parser.ts";
import { getIndexFromAlgebraic } from "./chess/chess.ts";
import { eq, throws } from "./lib/check.ts";

const g = new Game();
eq("a new game: the start position, white to move, nothing to undo or redo", [g.fen(), g.turn(), g.canUndo(), g.canRedo(), g.status(), g.result()], [START_FEN, "white", false, false, "in_progress", "*"]);
eq("twenty legal moves", g.legalMoves().length, 20);

// The Scholar's mate, move by move.
const play = (text: string) => {
  const m = g.find(text);
  if (!m) throw new Error(`no move ${text}`);
  return g.move(m).san;
};
eq("moves found by coordinate or SAN, made with their SAN", ["e2e4", "e5", "Bc4", "Nc6", "Qh5", "g8f6"].map(play), ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"]);
eq("the lists so far", [g.moveList(), g.sanList(), g.turn(), g.steps], [["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6"], ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"], "white", [1, 1, 1, 1, 1, 1]]);
eq("a move that is not legal is not found", [g.find("e2e4"), g.find("a1a3"), g.find("zz")], [null, null, null]);
eq("a move's SAN has its mate mark; the game is over, 1-0", [play("Qxf7"), g.status(), g.result(), g.isOver(), g.legalMoves().length], ["Qxf7#", "checkmate", "1-0", true, 0]);
eq("no move after the end", g.find("Ke7"), null);

// Undo to the start, redo to the end.
eq("undo gives the step back", g.undo()!.map((m) => m.san), ["Qxf7#"]);
eq("and the game goes on", [g.status(), g.canRedo(), g.turn()], ["in_progress", true, "white"]);
let n = 0;
while (g.undo()) n++;
eq("undo to the start: six more steps, the start position", [n, g.fen(), g.canUndo(), g.canRedo(), g.made.length], [6, START_FEN, false, true, 0]);
eq("undo at the start gives null", g.undo(), null);
n = 0;
while (g.redo()) n++;
eq("redo to the end: all seven, mate again", [n, g.sanList().join(" "), g.status(), g.canRedo()], [7, "e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#", "checkmate", false]);
eq("redo at the end gives null", g.redo(), null);
g.undo(); g.undo();
eq("a new move after undo forgets the redo", [play("d6"), g.canRedo(), g.sanList().length], ["d6", false, 6]);

// A new game clears the lists.
g.newGame();
eq("a new game clears the lists", [g.fen(), g.made, g.steps, g.redoSteps, g.canUndo(), g.canRedo(), g.startFen], [START_FEN, [], [], [], false, false, START_FEN]);

// A position from FEN; the game starts there.
g.setPosition("4k3/8/8/8/8/8/8/4K2R w K - 0 1");
eq("a position set from FEN: black to be mated by a rook", [g.turn(), g.legalMoves().length, g.startFen], ["white", 15, "4k3/8/8/8/8/8/8/4K2R w K - 0 1"]);
eq("castling in it", play("O-O"), "O-O");
g.undo();
eq("undo goes back to the set position, not the start of chess", g.fen(), "4k3/8/8/8/8/8/8/4K2R w K - 0 1");
throws("a FEN that is none is refused, the game as it was", () => g.setPosition("nonsense"), Error, "FEN: 2 to 6 fields, not 1");
eq("still there", g.fen(), "4k3/8/8/8/8/8/8/4K2R w K - 0 1");

// Stalemate, resignation, a draw agreed.
g.setPosition("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
eq("stalemate", [g.status(), g.result()], ["stalemate", "1/2-1/2"]);
g.newGame();
play("e4");
g.resign();
eq("black (to move) resigns: 1-0", [g.status(), g.result(), g.isOver(), g.resigned], ["resigned", "1-0", true, "black"]);
throws("no resigning twice", () => g.resign(), Error, "the game is over");
eq("undo takes the resignation back with the move", [g.undo()!.length, g.status(), g.result()], [1, "in_progress", "*"]);
g.agreeDraw();
eq("a draw agreed", [g.status(), g.result()], ["draw_agreed", "1/2-1/2"]);
g.newGame();
play("e4");
g.resign("white");
eq("white resigns on its own move: 0-1", g.result(), "0-1");

// A group: the moves of one request as one step.
g.newGame();
g.beginGroup();
play("e4"); play("e5"); play("Nf3");
eq("three moves in a group, one step", [g.endGroup(), g.steps, g.made.length], [true, [3], 3]);
eq("one undo takes all three back", [g.undo()!.map((m) => m.san), g.fen()], [["e4", "e5", "Nf3"], START_FEN]);
eq("and one redo puts them back", [g.redo()!.length, g.sanList()], [3, ["e4", "e5", "Nf3"]]);
g.beginGroup();
eq("a group with no move makes no step", [g.endGroup(), g.steps], [false, [3]]);
play("Nc6");
eq("after the group, a move is a step of its own", g.steps, [3, 1]);

// A snapshot restored whole.
g.undo();
g.aiLevel = 3; g.aiSide = "black"; g.flipped = true;
const s = g.saved();
eq("the snapshot", s, { startFen: START_FEN, moves: ["e2e4", "e7e5", "g1f3"], steps: [3], redo: [["b8c6"]], resigned: null, drawAgreed: false, aiLevel: 3, aiSide: "black", flipped: true, dark: false, boardSize: 480, boardFit: true });
play("d6"); g.newGame(); g.aiSide = "none";
const h = new Game();
h.restore(s);
eq("restored: the moves, their SAN, the steps, the redo, the settings", [h.sanList(), h.steps, h.redoSteps.map((st) => st.map((m) => m.san)), h.aiLevel, h.aiSide, h.flipped, h.fen() === g.fen()],
  [["e4", "e5", "Nf3"], [3], [["Nc6"]], 3, "black", true, false]);
eq("and redo works on the restored game", h.redo()!.map((m) => m.san), ["Nc6"]);
eq("pieces by square", [h.pieceAt(getIndexFromAlgebraic("e4")), h.pieceAt(getIndexFromAlgebraic("c6")), h.pieceAt(getIndexFromAlgebraic("e1")), h.pieceAt(getIndexFromAlgebraic("d4"))], ["P", "n", "K", ""]);
eq("the levels are 1 to 4", LEVELS, [1, 2, 3, 4]);

// Going to a move: undo or redo whole steps, the future kept to redo.
const k = new Game();
for (const t of ["e4", "e5", "Nf3", "Nc6", "Bc4"]) k.move(k.find(t)!);
eq("goto 2: undo to after 1... e5, the rest ahead", [k.goto(2), k.sanList(), k.future().map((m) => m.san)], [2, ["e4", "e5"], ["Nf3", "Nc6", "Bc4"]]);
eq("goto 4: redo to after 2... Nc6", [k.goto(4), k.sanList(), k.future().map((m) => m.san)], [4, ["e4", "e5", "Nf3", "Nc6"], ["Bc4"]]);
eq("goto 0 and goto past the end", [k.goto(0), k.fen(), k.goto(99), k.sanList().length], [0, START_FEN, 5, 5]);
k.goto(1);
k.beginGroup(); k.move(k.find("d5")!); k.move(k.find("exd5")!); k.endGroup();
eq("a group is not split: goto 2 lands at its end's step before", [k.goto(2), k.goto(3), k.goto(2)], [1, 3, 1]);

// The status in words, the pieces taken and the balance.
const w = new Game();
eq("the status in words", [w.statusText()], ["white to move"]);
for (const t of ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5"]) w.move(w.find(t)!);
eq("a pawn each taken, level", w.captured(), { byWhite: ["p"], byBlack: ["P"], balance: 0 });
for (const t of ["Bc4", "Nf6", "Bxf7+"]) w.move(w.find(t)!);
eq("a pawn up, and in check said", [w.captured(), w.statusText()], [{ byWhite: ["p", "p"], byBlack: ["P"], balance: 1 }, "black to move, in check"]);
const m = new Game();
for (const t of ["f3", "e5", "g4", "Qh4"]) m.move(m.find(t)!);
eq("checkmate said with the winner", m.statusText(), "checkmate: black wins (0-1)");
m.setPosition("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
eq("stalemate said, and a set position's own pieces the base", [m.statusText(), m.captured()], ["stalemate: black has no move, a draw (1/2-1/2)", { byWhite: [], byBlack: [], balance: 9 }]);
m.setPosition("8/8/8/4k3/8/8/8/4K3 w - - 0 1");
eq("insufficient material said", m.statusText(), "a draw: neither side has the pieces to mate (1/2-1/2)");
m.setPosition("7k/8/8/8/8/8/8/K6R w - - 100 80");
eq("the fifty-move rule said", m.statusText(), "a draw by the fifty-move rule: fifty moves each with no capture or pawn move (1/2-1/2)");
m.newGame(); m.move(m.find("e4")!); m.resign();
eq("a resignation said", m.statusText(), "black resigned: white wins (1-0)");

// The game as a file, and back.
const f = new Game();
for (const t of ["e4", "e5", "Nf3"]) f.move(f.find(t)!);
f.aiLevel = 3; f.aiSide = "black"; f.flipped = true;
eq("its file", f.toFile(), { format: "sae-chess-game", version: 1, start: START_FEN, moves: ["e2e4", "e7e5", "g1f3"], aiLevel: 3, aiSide: "black", flipped: true });
const r = new Game();
r.fromFile(JSON.stringify(f.toFile()));
eq("read back: the moves, the settings, a move at a time to undo", [r.sanList(), r.aiLevel, r.aiSide, r.flipped, r.steps, r.canRedo()], [["e4", "e5", "Nf3"], 3, "black", true, [1, 1, 1], false]);
r.fromFile('{"format": "sae-chess-game", "version": 1, "start": "7k/P7/8/8/8/8/8/K7 w - - 0 1", "moves": ["a7a8q"], "resigned": "black", "aiLevel": 2, "aiSide": "none", "flipped": false}');
eq("from a set position, a resignation kept", [r.sanList(), r.result(), r.startFen], [["a8=Q+"], "1-0", "7k/P7/8/8/8/8/8/K7 w - - 0 1"]);
throws("not JSON", () => r.fromFile("nope"), Error, "a game file is JSON: unexpected token: 'nope'");
throws("not a game file", () => r.fromFile("{}"), Error, 'a game file says "format": "sae-chess-game"');
throws("a move that is not legal, said which", () => r.fromFile('{"format": "sae-chess-game", "version": 1, "start": "' + START_FEN + '", "moves": ["e2e4", "e2e4"]}'), Error, "the game file's move 2, e2e4, is not legal there");
eq("and the game as it was after a refusal", r.sanList(), ["a8=Q+"]);

// expect: ok a new game: the start position, white to move, nothing to undo or redo
// expect: ok twenty legal moves
// expect: ok moves found by coordinate or SAN, made with their SAN
// expect: ok the lists so far
// expect: ok a move that is not legal is not found
// expect: ok a move's SAN has its mate mark; the game is over, 1-0
// expect: ok no move after the end
// expect: ok undo gives the step back
// expect: ok and the game goes on
// expect: ok undo to the start: six more steps, the start position
// expect: ok undo at the start gives null
// expect: ok redo to the end: all seven, mate again
// expect: ok redo at the end gives null
// expect: ok a new move after undo forgets the redo
// expect: ok a new game clears the lists
// expect: ok a position set from FEN: black to be mated by a rook
// expect: ok castling in it
// expect: ok undo goes back to the set position, not the start of chess
// expect: ok a FEN that is none is refused, the game as it was
// expect: ok still there
// expect: ok stalemate
// expect: ok black (to move) resigns: 1-0
// expect: ok no resigning twice
// expect: ok undo takes the resignation back with the move
// expect: ok a draw agreed
// expect: ok white resigns on its own move: 0-1
// expect: ok three moves in a group, one step
// expect: ok one undo takes all three back
// expect: ok and one redo puts them back
// expect: ok a group with no move makes no step
// expect: ok after the group, a move is a step of its own
// expect: ok the snapshot
// expect: ok restored: the moves, their SAN, the steps, the redo, the settings
// expect: ok and redo works on the restored game
// expect: ok pieces by square
// expect: ok the levels are 1 to 4
// expect: ok goto 2: undo to after 1... e5, the rest ahead
// expect: ok goto 4: redo to after 2... Nc6
// expect: ok goto 0 and goto past the end
// expect: ok a group is not split: goto 2 lands at its end's step before
// expect: ok the status in words
// expect: ok a pawn each taken, level
// expect: ok a pawn up, and in check said
// expect: ok checkmate said with the winner
// expect: ok stalemate said, and a set position's own pieces the base
// expect: ok insufficient material said
// expect: ok the fifty-move rule said
// expect: ok a resignation said
// expect: ok its file
// expect: ok read back: the moves, the settings, a move at a time to undo
// expect: ok from a set position, a resignation kept
// expect: ok not JSON
// expect: ok not a game file
// expect: ok a move that is not legal, said which
// expect: ok and the game as it was after a refusal
