// app/chess/commands.ts: each command run by id with string parameters,
// its refusal of a bad parameter, and the game's undo of each move it
// made; a command line parsed and written; the journal; game.state.
import { Commands } from "./chess/commands.ts";
import { legalMovesOf } from "./chess/game.ts";
import { lineOf, parseLine } from "./chess/line.ts";
import { START_FEN } from "./chess/parser.ts";
import { eq } from "./lib/check.ts";

const c = new Commands();
const ok = (line: string) => {
  const o = c.run(line);
  return o.ok ? o.message : `REFUSED ${o.message}`;
};
const refused = (line: string) => {
  const o = c.run(line);
  return o.ok ? `OK ${o.message}` : o.message;
};

eq("the catalogue", c.catalogue().map((x) => x.id), ["game.new", "game.move", "game.undo", "game.redo", "game.goto", "game.setPosition", "game.resign", "game.offerDraw", "ai.level", "ai.side", "ai.move", "ai.analyze", "ai.hint", "board.flip", "game.script", "game.export", "game.import", "game.exportPgn", "game.importPgn", "game.save", "game.open", "game.kept", "game.forget", "view.dark", "view.boardSize", "game.state"]);
eq("searched by label", c.catalogue("flip").map((x) => `${x.id}: ${x.label}`), ["board.flip: Flip the board"]);
eq("a command line parsed", parseLine('game.move from=e2 to=e4 san="Nf3" x=""'), { id: "game.move", params: { from: "e2", to: "e4", san: "Nf3", x: "" } });
eq("and written", lineOf("game.setPosition", { fen: "8/8 w - - 0 1" }), 'game.setPosition fen="8/8 w - - 0 1"');

// game.move: from and to, san, move; promotion; refusals.
eq("from and to", ok("game.move from=e2 to=e4"), "white played e4");
eq("san", ok("game.move san=e5"), "black played e5");
eq("coordinate", ok("game.move move=g1f3"), "white played Nf3");
eq("what it gives is the SAN", c.run("game.move san=Nc6").output, "Nc6");
eq("a square that is none", refused("game.move from=e9 to=e4"), "e9 is not a square (a1 to h8)");
eq("a move that is not legal", refused("game.move from=e2 to=e4"), "e2 to e4 is not a legal move for white");
eq("SAN that is none", refused("game.move san=Qh9"), "Qh9 is not a legal move for white");
eq("no move given", refused("game.move"), "game.move needs from and to, san, or move");
eq("a promotion piece that is none", refused("game.move from=e2 to=e4 promotion=king"), "king is not a promotion piece (queen, rook, bishop or knight)");
eq("no command", refused("game.nope"), "no command game.nope");
eq("a missing parameter", refused("game.setPosition"), "game.setPosition needs fen");

// game.undo and game.redo.
eq("undo", [ok("game.undo"), c.run("game.state").output.sans], ["undid Nc6", ["e4", "e5", "Nf3"]]);
eq("redo", [ok("game.redo"), c.run("game.state").output.sans], ["redid Nc6", ["e4", "e5", "Nf3", "Nc6"]]);
eq("nothing to redo", [ok("game.redo"), c.run("game.redo").output], ["nothing to redo", 0]);
for (let i = 0; i < 4; i++) c.run("game.undo");
eq("nothing to undo, at the start", [ok("game.undo"), c.run("game.state").output.fen], ["nothing to undo", START_FEN]);

// game.setPosition, a promotion, game.state.
eq("a position from FEN", ok("game.setPosition fen=\"7k/P7/8/8/8/8/8/K7 w - - 0 1\""), "the position is set: white to move");
eq("a FEN that is none, said why", refused("game.setPosition fen=\"8/8/8 w\""), "FEN: 8 ranks, not 3");
eq("the legal moves, as a script sees them", legalMovesOf(c.game).filter((m) => m.promotion).map((m) => [m.from, m.to, m.piece, m.capture, m.promotion, m.san, m.coordinate]),
  [["a7", "a8", "P", false, "Q", "a8=Q+", "a7a8q"], ["a7", "a8", "P", false, "R", "a8=R+", "a7a8r"], ["a7", "a8", "P", false, "B", "a8=B", "a7a8b"], ["a7", "a8", "P", false, "N", "a8=N", "a7a8n"]]);
eq("a promotion to a knight: king and knight cannot mate", ok("game.move from=a7 to=a8 promotion=knight"), "white played a8=N (insufficient_material_draw, 1/2-1/2)");
c.run("game.undo");
eq("to a queen, with check", ok("game.move from=a7 to=a8 promotion=q"), "white played a8=Q+");
const st = c.run("game.state").output;
eq("game.state", [st.turn, st.status, st.check, st.sans, st.lastMove, st.legalMoves, st.fullmoveNumber, st.canUndo, st.canRedo, st.startFen, st.aiLevel, st.aiSide, st.flipped],
  ["black", "check", true, ["a8=Q+"], "a7a8q", 2, 1, true, false, "7k/P7/8/8/8/8/8/K7 w - - 0 1", 2, "none", false]);
const journaled = c.journal().length;
c.run("game.state");
eq("game.state is not journaled", c.journal().length, journaled);

// The end of a game: mate, resigning, a draw.
c.run("game.new");
for (const san of ["f3", "e5", "g4"]) c.run(`game.move san=${san}`);
eq("the mating move says so", ok("game.move san=Qh4"), "black played Qh4# (checkmate, 0-1)");
eq("no move after mate", refused("game.move san=Ke2"), "the game is over (checkmate, 0-1)");
eq("no resigning after mate", refused("game.resign"), "the game is over (checkmate, 0-1)");
c.run("game.new");
c.run("game.move san=e4");
eq("the side to move resigns", [ok("game.resign"), c.run("game.state").output.result], ["black resigns: 1-0", "1-0"]);
eq("undo takes it back", [ok("game.undo"), c.run("game.state").output.status], ["undid e4", "in_progress"]);
eq("a side named", ok("game.resign side=white"), "white resigns: 0-1");
c.run("game.new");
c.run("game.move san=d4");
eq("a side that is none", refused("game.resign side=red"), "red is not a side (white or black)");
eq("a draw offered is agreed", [ok("game.offerDraw"), c.run("game.state").output.status], ["a draw is agreed: 1/2-1/2", "draw_agreed"]);
eq("no offering twice", refused("game.offerDraw"), "the game is over (draw_agreed, 1/2-1/2)");

// The computer player's settings, the board.
eq("ai.level", [ok("ai.level level=4"), c.game.aiLevel], ["the computer plays at level 4", 4]);
eq("a level that is none", refused("ai.level level=9"), "9 is not a level (1 to 4)");
eq("ai.side", [ok("ai.side side=Black"), ok("ai.side side=none")], ["the computer plays black", "the computer plays neither side"]);
eq("a side that is none", refused("ai.side side=green"), "green is not a side (white, black, both or none)");
c.run("game.new");
eq("ai.move: the computer plays at its level, one step of undo", [ok("ai.move"), ok("game.undo"), c.run("game.state").output.fen], ["the computer (white, level 4) played Nf3", "undid Nf3", START_FEN]);
eq("view.dark: on, off, toggled, refused", [ok("view.dark on=1"), c.game.dark, ok("view.dark on=off"), ok("view.dark"), c.game.dark, refused("view.dark on=maybe")], ["dark mode", true, "light mode", "dark mode", true, "maybe is not on or off (1 or 0)"]);
c.run("view.dark on=0");
eq("view.boardSize: set, by a step, held to its limits, refused", [ok("view.boardSize px=640"), ok("view.boardSize by=80"), ok("view.boardSize by=800"), refused("view.boardSize px=100"), refused("view.boardSize px=big"), c.game.boardSize],
  ["the board is 640 pixels square", "the board is 720 pixels square", "the board is 960 pixels square", "a board is 240 to 960 pixels, not 100", "big is not a number of pixels", 960]);
c.run("view.boardSize px=480");
eq("board.flip", [ok("board.flip"), c.game.flipped, ok("board.flip"), c.game.flipped], ["black at the bottom", true, "white at the bottom", false]);
eq("game.new clears the game and keeps the settings", [c.run("game.state").output.fen, c.game.aiLevel], [START_FEN, 4]);

// The journal: the lines that changed the game, which replay.
const d = new Commands();
for (const line of c.journal()) d.run(line);
eq("the journal replays to the same game", [d.run("game.state").output.fen, d.game.aiLevel, d.game.flipped], [c.run("game.state").output.fen, 4, false]);
eq("its first lines", c.journal().slice(0, 4), ["game.move from=e2 to=e4", "game.move san=e5", "game.move move=g1f3", "game.move san=Nc6"]);

// expect: ok the catalogue
// expect: ok searched by label
// expect: ok a command line parsed
// expect: ok and written
// expect: ok from and to
// expect: ok san
// expect: ok coordinate
// expect: ok what it gives is the SAN
// expect: ok a square that is none
// expect: ok a move that is not legal
// expect: ok SAN that is none
// expect: ok no move given
// expect: ok a promotion piece that is none
// expect: ok no command
// expect: ok a missing parameter
// expect: ok undo
// expect: ok redo
// expect: ok nothing to redo
// expect: ok nothing to undo, at the start
// expect: ok a position from FEN
// expect: ok a FEN that is none, said why
// expect: ok the legal moves, as a script sees them
// expect: ok a promotion to a knight: king and knight cannot mate
// expect: ok to a queen, with check
// expect: ok game.state
// expect: ok game.state is not journaled
// expect: ok the mating move says so
// expect: ok no move after mate
// expect: ok no resigning after mate
// expect: ok the side to move resigns
// expect: ok undo takes it back
// expect: ok a side named
// expect: ok a side that is none
// expect: ok a draw offered is agreed
// expect: ok no offering twice
// expect: ok ai.level
// expect: ok a level that is none
// expect: ok ai.side
// expect: ok a side that is none
// expect: ok ai.move: the computer plays at its level, one step of undo
// expect: ok view.dark: on, off, toggled, refused
// expect: ok view.boardSize: set, by a step, held to its limits, refused
// expect: ok board.flip
// expect: ok game.new clears the game and keeps the settings
// expect: ok the journal replays to the same game
// expect: ok its first lines
