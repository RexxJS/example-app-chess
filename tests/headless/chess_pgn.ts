// app/chess/pgn.ts (TODO.md 5.1): PGN written and read. The standard's own
// sample game (Fischer - Spassky, 1992, with its comment) and Morphy's
// Opera game read, their moves legal, their results; written back with
// the tags, the comment and the moves as they were; a variation, a NAG and
// !? marks kept after their moves; a set-up position's SetUp and FEN; a
// result the moves do not reach read as a resignation or a draw agreed;
// the second game of a file left alone; what is wrong with a text said;
// the commands and EXPORTPGN/IMPORTPGN.
import { Game } from "./chess/game.ts";
import { parsePgn, toPgn } from "./chess/pgn.ts";
import { Commands } from "./chess/commands.ts";
import { controlFunctions } from "./chess/control.ts";
import { eq, throws } from "./lib/check.ts";

const FISCHER = `[Event "F/S Return Match"]
[Site "Belgrade, Serbia JUG"]
[Date "1992.11.04"]
[Round "29"]
[White "Fischer, Robert J."]
[Black "Spassky, Boris V."]
[Result "1/2-1/2"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 {This opening is called the Ruy Lopez.}
4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7
11. c4 c6 12. cxb5 axb5 13. Nc3 Bb7 14. Bg5 b4 15. Nb1 h6 16. Bh4 c5 17. dxe5
Nxe4 18. Bxe7 Qxe7 19. exd6 Qf6 20. Nbd2 Nxd6 21. Nc4 Nxc4 22. Bxc4 Nb6
23. Ne5 Rae8 24. Bxf7+ Rxf7 25. Nxf7 Rxe1+ 26. Qxe1 Kxf7 27. Qe3 Qg5 28. Qxg5
hxg5 29. b3 Ke6 30. a3 Kd6 31. axb4 cxb4 32. Ra5 Nd5 33. f3 Bc8 34. Kf2 Bf5
35. Ra7 g6 36. Ra6+ Kc5 37. Ke1 Nf4 38. g3 Nxh3 39. Kd2 Kb5 40. Rd6 Kc5 41. Ra6
Nf2 42. g4 Bd3 43. Re6 1/2-1/2
`;
const OPERA = `[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[Round "?"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7
8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7
14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# 1-0

[Event "the next game, not read"]
[Result "*"]

1. d4 *
`;

// The movetext as one line, however it was wrapped.
const flat = (t: string) => t.replace(/\n/g, " ");

const f = new Game();
f.fromPgn(FISCHER);
eq("the standard's sample: 85 moves, drawn by agreement (the moves do not end it)", [f.made.length, f.result(), f.status()], [85, "1/2-1/2", "draw_agreed"]);
eq("its last move and its tags kept", [f.sanList()[84], f.pgn!.tags.length, f.pgn!.tags[4]], ["Re6", 7, ["White", "Fischer, Robert J."]]);
eq("its comment kept after 3... a6", f.pgn!.notes[5], "{This opening is called the Ruy Lopez.}");
const fOut = f.toPgn();
eq("written: the roster as read", fOut.split("\n").slice(0, 7), FISCHER.split("\n").slice(0, 7));
eq("the comment after its move, black's next numbered 4.", flat(fOut).includes("3. Bb5 a6 {This opening is called the Ruy Lopez.} 4. Ba4 Nf6"), true);
eq("lines of 80 at most", fOut.split("\n").every((l) => l.length <= 80), true);
eq("and read again, the same game", (() => {
  const g = new Game();
  g.fromPgn(fOut);
  return [g.sanList().join(" ") === f.sanList().join(" "), g.result(), g.toPgn() === fOut];
})(), [true, "1/2-1/2", true]);

const o = new Game();
o.fromPgn(OPERA);
eq("the Opera game: 33 moves, mate (1-0), glued move numbers read", [o.made.length, o.status(), o.result(), o.sanList()[32]], [33, "checkmate", "1-0", "Rd8#"]);
eq("one game read: the next one left alone", o.pgn!.tags[0], ["Event", "Paris"]);

// Variations, NAGs, marks, line comments.
const annotated = new Game();
annotated.fromPgn(`1. e4 e5 2. Nf3!? $1 (2. f4 exf4 (2... d5) 3. Nf3) Nc6 ; a line comment\n3. Bb5 *`);
eq("a variation (nested), a NAG and !? kept after their move", annotated.pgn!.notes[2], "!? $1 (2. f4 exf4 (2... d5) 3. Nf3)");
eq("a ; comment kept as a {comment}", annotated.pgn!.notes[3], "{a line comment}");
eq("the moves themselves: the main line only", annotated.sanList(), ["e4", "e5", "Nf3", "Nc6", "Bb5"]);
const aOut = annotated.toPgn("2026.10.16");
eq("written back: after the variation, black's move numbered", flat(aOut.split("\n\n")[1]).trim(), "1. e4 e5 2. Nf3!? $1 (2. f4 exf4 (2... d5) 3. Nf3) 2... Nc6 {a line comment} 3. Bb5 *");
eq("a game not read from PGN: the roster made up, today's date", aOut.split("\n").slice(0, 7), ['[Event "Casual game"]', '[Site "sae chess"]', '[Date "2026.10.16"]', '[Round "-"]', '[White "?"]', '[Black "?"]', '[Result "*"]']);
annotated.undo();
annotated.move(annotated.find("Bc4")!);
eq("a move changed: its notes go, the earlier stay", flat(annotated.toPgn()).includes("{a line comment} 3. Bc4 *"), true);

// A set-up position, black to move: SetUp, FEN, "1..." first.
const set = new Game("4k3/8/8/8/8/8/4P3/4K3 b - - 0 7");
set.move(set.find("Kd7")!);
set.move(set.find("e4")!);
const sOut = set.toPgn("2026.10.16");
eq("a set-up position: SetUp and FEN, black's first move 7...", [sOut.includes('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 7"]'), sOut.split("\n\n")[1].trim()], [true, "7... Kd7 8. e4 *"]);
eq("and read back from it", (() => {
  const g = new Game();
  g.fromPgn(sOut);
  return [g.startFen, g.sanList()];
})(), ["4k3/8/8/8/8/8/4P3/4K3 b - - 0 7", ["Kd7", "e4"]]);
eq("0-1 the moves do not reach: white resigned", (() => {
  const g = new Game();
  g.fromPgn("1. f3 e5 0-1");
  return [g.status(), g.result()];
})(), ["resigned", "0-1"]);

// What is wrong.
throws("an illegal move, said where", () => new Game().fromPgn("1. e4 e5 2. Ke3 *"), Error, "PGN: move 2. Ke3 is not legal there");
throws("a comment not closed", () => parsePgn("1. e4 {no end"), Error, "PGN: a comment { is not closed");
throws("a variation not closed", () => parsePgn("1. e4 (1. d4"), Error, "PGN: a variation ( is not closed");
throws("a tag that is none", () => parsePgn("[Event Paris]\n1. e4 *"), Error, "PGN: a tag is [Name \"value\"], not [Event Paris]");
throws("nothing", () => parsePgn("   "), Error, "PGN: no game here (no tags and no moves)");
const keepsIt = new Game();
keepsIt.move(keepsIt.find("d4")!);
try { keepsIt.fromPgn("1. e4 e5 2. Ke3 *"); } catch (_e) { /* refused */ }
eq("a game refused leaves this one as it was", keepsIt.sanList(), ["d4"]);

// The commands and the REXX functions.
const c = new Commands();
const fns = controlFunctions((id, params) => c.execute(id, params), c.game, {});
eq("IMPORTPGN: how many moves; one step of undo per move", [fns.IMPORTPGN(OPERA), fns.GETRESULT()], [33, "1-0"]);
eq("EXPORTPGN: the text", (fns.EXPORTPGN() as string).includes("17. Rd8# 1-0"), true);
eq("game.importPgn refuses, saying why", c.run('game.importPgn text="1. e9 *"').message, "PGN: move 1. e9 is not legal there");
eq("game.importPgn is journaled, game.exportPgn is not", c.journal().map((l) => l.split(" ")[0]), ["game.importPgn"]);

// expect: ok the standard's sample: 85 moves, drawn by agreement (the moves do not end it)
// expect: ok its last move and its tags kept
// expect: ok its comment kept after 3... a6
// expect: ok written: the roster as read
// expect: ok the comment after its move, black's next numbered 4.
// expect: ok lines of 80 at most
// expect: ok and read again, the same game
// expect: ok the Opera game: 33 moves, mate (1-0), glued move numbers read
// expect: ok one game read: the next one left alone
// expect: ok a variation (nested), a NAG and !? kept after their move
// expect: ok a ; comment kept as a {comment}
// expect: ok the moves themselves: the main line only
// expect: ok written back: after the variation, black's move numbered
// expect: ok a game not read from PGN: the roster made up, today's date
// expect: ok a move changed: its notes go, the earlier stay
// expect: ok a set-up position: SetUp and FEN, black's first move 7...
// expect: ok and read back from it
// expect: ok 0-1 the moves do not reach: white resigned
// expect: ok an illegal move, said where
// expect: ok a comment not closed
// expect: ok a variation not closed
// expect: ok a tag that is none
// expect: ok nothing
// expect: ok a game refused leaves this one as it was
// expect: ok IMPORTPGN: how many moves; one step of undo per move
// expect: ok EXPORTPGN: the text
// expect: ok game.importPgn refuses, saying why
// expect: ok game.importPgn is journaled, game.exportPgn is not
