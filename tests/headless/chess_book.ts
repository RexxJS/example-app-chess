// app/chess/book.ts (TODO.md 6.3): the opening book, written for this app
// from the openings' public names: every line legal, read into the
// positions it passes; a game's opening named (the last named position it
// reached, by any order of moves); the book's moves from a position; the
// computer playing from it (ai.book), the same move each time; and
// OPENINGNAME(), BOOKMOVES(), SETBOOK() in REXX.
import { Commands } from "./chess/commands.ts";
import { controlFunctions } from "./chess/control.ts";
import { LINES, book, bookMove, bookMoves, openingOf } from "./chess/book.ts";
import { Game } from "./chess/game.ts";
import { eq } from "./lib/check.ts";

const play = (sans: string): Game => {
  const g = new Game();
  for (const s of sans.split(" ").filter(Boolean)) g.move(g.find(s)!);
  return g;
};

const b = book();
eq("every line of the book read, and legal (book() throws on one that is not)", [LINES.length > 90, b.size > LINES.length], [true, true]);
eq("each line's name at its end", LINES.every(([name, line]) => openingOf(play(line)) === name), true);
eq("no name twice", new Set(LINES.map(([n]) => n)).size, LINES.length);
eq("the start: no opening yet, the book's first moves", [openingOf(new Game()), bookMoves(new Game()).sort()], ["", ["Nf3", "b3", "b4", "c4", "d4", "e4", "f4", "g4"]]);
eq("past a named position, its name stays", openingOf(play("e4 c5 Nf3 d6")), "Sicilian Defence");
eq("the deepest name the game reached", openingOf(play("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7")), "Ruy Lopez, Closed");
eq("a transposition: the Queen's Gambit Declined by 1. c4 e6 2. d4 d5", openingOf(play("c4 e6 d4 d5")), "Queen's Gambit Declined");
eq("and the Nimzo-Indian by 1. c4 e6 2. Nc3 Nf6 3. d4 Bb4", openingOf(play("c4 e6 Nc3 Nf6 d4 Bb4")), "Nimzo-Indian Defence");
eq("out of the book: the name it had, and no book moves", [openingOf(play("e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#")), bookMoves(play("e4 e5 Qh5"))], ["Open Game", []]);
eq("the book's moves after 1. e4 c5 2. Nf3", bookMoves(play("e4 c5 Nf3")).sort(), ["Nc6", "d6", "e6"]);
eq("a game set up from another position: none", openingOf(new Game("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1")), "");

// The computer from the book: a book move, the same each time.
const m1 = bookMove(play("e4 e5 Nf3")), m2 = bookMove(play("e4 e5 Nf3"));
eq("a book move: one of the book's, the same for the same position", [m1 !== null, m1 === m2, ["b8c6", "d7d6", "g8f6", "f7f5", "d7d5"].includes(m1!)], [true, true, true]);
const c = new Commands();
eq("ai.book: off at first, then on", [c.game.book, c.run("ai.book on=1").output, c.game.book], [false, 1, true]);
const o = c.run("ai.move");
eq("ai.move from the book: said so, and a first move of the book", [o.message.includes("from the book"), ["e4", "d4", "c4", "Nf3", "f4", "b3", "b4", "g4"].includes(String(o.output))], [true, true]);
let n = 1;
while (c.game.book && bookMoves(c.game).length && n < 30) {
  c.run("ai.move");
  n++;
}
eq("the computer plays the book to a line's end, and names it", [openingOf(c.game) !== "", bookMoves(c.game).length], [true, 0]);
eq("then it thinks: out of the book, at its level", c.run("ai.move").message.includes("level 2"), true);
eq("ai.book is kept in the game's file and its snapshot", [JSON.parse(String(c.run("game.export").output)).book, (() => { const g = new Game(); g.fromFile(String(c.run("game.export").output)); return g.book; })()], [true, true]);
eq("ai.book off; a bad flag refused", [c.run("ai.book on=0").output, c.run("ai.book on=maybe").message], [0, "maybe is not on or off (1 or 0)"]);

// REXX.
const r = new Commands();
const fns = controlFunctions((id, params) => r.execute(id, params), r.game, {});
fns.MOVESAN("e4");
fns.MOVESAN("c6");
eq("OPENINGNAME()", fns.OPENINGNAME(), "Caro-Kann Defence");
eq("BOOKMOVES(): a stem", fns.BOOKMOVES(), { 0: 2, 1: "d4", 2: "Nc3" });
eq("SETBOOK(1), then AIMOVE() plays from it", [fns.SETBOOK(1), ["d4", "Nc3"].includes(String(fns.AIMOVE()))], [1, true]);
eq("SETBOOK() the other", fns.SETBOOK(), 0);

// expect: ok every line of the book read, and legal (book() throws on one that is not)
// expect: ok each line's name at its end
// expect: ok no name twice
// expect: ok the start: no opening yet, the book's first moves
// expect: ok past a named position, its name stays
// expect: ok the deepest name the game reached
// expect: ok a transposition: the Queen's Gambit Declined by 1. c4 e6 2. d4 d5
// expect: ok and the Nimzo-Indian by 1. c4 e6 2. Nc3 Nf6 3. d4 Bb4
// expect: ok out of the book: the name it had, and no book moves
// expect: ok the book's moves after 1. e4 c5 2. Nf3
// expect: ok a game set up from another position: none
// expect: ok a book move: one of the book's, the same for the same position
// expect: ok ai.book: off at first, then on
// expect: ok ai.move from the book: said so, and a first move of the book
// expect: ok the computer plays the book to a line's end, and names it
// expect: ok then it thinks: out of the book, at its level
// expect: ok ai.book is kept in the game's file and its snapshot
// expect: ok ai.book off; a bad flag refused
// expect: ok OPENINGNAME()
// expect: ok BOOKMOVES(): a stem
// expect: ok SETBOOK(1), then AIMOVE() plays from it
// expect: ok SETBOOK() the other
