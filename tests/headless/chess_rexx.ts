// app/chess/script.ts: a REXX script with ADDRESS CHESS and the control
// functions, on an interpreter of its own. The five examples of
// CHESS_COMMANDS.md run as they are (the old 12 commands by their old
// names), RC and RESULT as the old handler set them; the functions by
// name; a control-bus request (runChess through Commands.chess) as one
// step of undo, taken back whole when it fails or sae stops it.
import { Commands } from "./chess/commands.ts";
import { eq } from "./lib/check.ts";

const c = new Commands();
const ask0 = (code: string) => c.chess(code, () => {});
const said: string[] = [];
const run = async (text: string) => {
  said.length = 0;
  const o = await c.script(text, (line) => said.push(line));
  return o.ok ? [...said] : [`FAILED: ${o.message}`, ...said];
};

// The old CHESS_COMMANDS.md (before 2.7), "Quick Start: In-App Execution".
eq("the quick start", await run(`/* Make opening moves */
ADDRESS CHESS "move from=e2 to=e4"
ADDRESS CHESS "move from=c7 to=c5"

/* Check game status */
ADDRESS CHESS "get-status"
SAY "Game: " RESULT

/* Get available moves */
ADDRESS CHESS "get-moves"
SAY "Legal moves: " RESULT

/* Display board */
ADDRESS CHESS "get-board"
SAY RESULT`), [
  'Game:  {"status":"in_progress","toPlay":"white","isCheck":0,"legalMoves":30,"result":"*"}',
  'Legal moves:  ["a2a4","b2b4","c2c4","d2d4","f2f4","g2g4","h2h4","a2a3","b2b3","c2c3","d2d3","f2f3","g2g3","h2h3","e4e5","b1a3","b1c3","g1e2","g1f3","g1h3","d1e2","d1f3","d1g4","d1h5","f1e2","f1d3","f1c4","f1b5","f1a6","e1e2"]',
  "  a b c d e f g h\n8 ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜ 8\n7 ♟ ♟ . ♟ ♟ ♟ ♟ ♟ 7\n6 . . . . . . . . 6\n5 . . ♟ . . . . . 5\n4 . . . . ♙ . . . 4\n3 . . . . . . . . 3\n2 ♙ ♙ ♙ ♙ . ♙ ♙ ♙ 2\n1 ♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖ 1\n  a b c d e f g h",
]);
eq("the whole script was one step of undo", [[...c.game.steps], c.run("game.undo").message], [[2], "undid e4 c5"]);

// Example 1: Opening Sequence.
eq("example 1", await run(`/* Play a common opening sequence */
ADDRESS CHESS "move from=e2 to=e4"
SAY "1. e4"

ADDRESS CHESS "move from=c7 to=c5"
SAY "1... c5 (Sicilian Defense)"

ADDRESS CHESS "move from=g1 to=f3"
SAY "2. Nf3"

ADDRESS CHESS "get-status"
SAY "Status: " RESULT`), ["1. e4", "1... c5 (Sicilian Defense)", "2. Nf3", 'Status:  {"status":"in_progress","toPlay":"black","isCheck":0,"legalMoves":22,"result":"*"}']);

// Example 2: Analyze Position.
const ex2 = await run(`/* Get detailed position information */
ADDRESS CHESS "get-board"
SAY "Current Board:"
SAY RESULT

ADDRESS CHESS "get-status"
SAY "Game Status:"
SAY RESULT

ADDRESS CHESS "list-legal-moves"
SAY "Legal Moves:"
SAY RESULT

ADDRESS CHESS "get-position-fen"
SAY "FEN: " RESULT`);
eq("example 2", [ex2[0], ex2[1].split("\n")[1], ex2[2], ex2[3], ex2[4], JSON.parse(ex2[5])[0], ex2[6]],
  ["Current Board:", "8 ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜ 8", "Game Status:", '{"status":"in_progress","toPlay":"black","isCheck":0,"legalMoves":22,"result":"*"}', "Legal Moves:",
    { from: "a7", to: "a5", piece: "P", capture: 0, promotion: "", san: "a5", coordinate: "a7a5" }, "FEN:  rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2"]);

// Example 3: Move Validation, as written: IF ... THEN with its statement on
// the next line, which RexxJS takes since d050b3d
// (asks/REPLY-rexxjs-if-then-next-line.md).
c.run("game.new");
eq("example 3", await run(`/* Try moves and validate them */
ADDRESS CHESS "move from=e2 to=e4"
IF RC = 0 THEN
    SAY "✓ e2-e4 is legal"
ELSE
    SAY "✗ e2-e4 is illegal: " RC

ADDRESS CHESS "move from=e2 to=e5"
IF RC = 0 THEN
    SAY "✓ e2-e5 is legal"
ELSE
    SAY "✗ e2-e5 is illegal (pawn can only move 1 or 2 squares)"`), ["✓ e2-e4 is legal", "✗ e2-e5 is illegal (pawn can only move 1 or 2 squares)"]);

// Example 4: Undo/Redo.
c.run("game.new");
eq("example 4", await run(`/* Make and undo moves */
ADDRESS CHESS "move from=e2 to=e4"
SAY "Made move: e2-e4"

ADDRESS CHESS "get-status"
initial_status = RESULT

ADDRESS CHESS "undo"
SAY "Undo executed"

ADDRESS CHESS "get-status"
after_undo = RESULT

ADDRESS CHESS "redo"
SAY "Redo executed"

ADDRESS CHESS "get-status"
final_status = RESULT
SAY initial_status
SAY after_undo
SAY final_status`), ["Made move: e2-e4", "Undo executed", "Redo executed",
  '{"status":"in_progress","toPlay":"black","isCheck":0,"legalMoves":20,"result":"*"}',
  '{"status":"in_progress","toPlay":"white","isCheck":0,"legalMoves":20,"result":"*"}',
  '{"status":"in_progress","toPlay":"black","isCheck":0,"legalMoves":20,"result":"*"}']);

// Example 5: AI Difficulty Levels. As it is: "set-ai-difficulty level=" level
// has a blank after the =, so the level is refused (as the old handler
// refused it: RC 82 there, 1 here), and the script goes on; RESULT.0 of
// get-moves's JSON text is not a stem's count.
const ex5 = await run(`/* Test different AI difficulty levels */
DO level = 1 TO 4
    ADDRESS CHESS "new-game"
    ADDRESS CHESS "set-ai-difficulty level=" level
    SAY "AI difficulty set to level " level

    /* Make white's opening move */
    ADDRESS CHESS "move from=e2 to=e4"
    SAY "White: e2-e4"

    /* Let AI respond (black automatically moves when it's black's turn) */
    ADDRESS CHESS "get-moves"
    SAY "After AI move, " RESULT.0 " legal moves remain"
END`);
eq("example 5 runs through its four levels", [ex5.length, ex5[0], ex5[1], ex5[9], ex5[11].startsWith("After AI move, ")], [12, "AI difficulty set to level  1", "White: e2-e4", "AI difficulty set to level  4", true]);
eq("set-ai-difficulty with the level given", await run('ADDRESS CHESS "set-ai-difficulty level=3"\nSAY RC RESULT\nSAY GETAIDIFFICULTY()'), ["0 3", "3"]);

// RC and RESULT as the old handler set them: 2 for a command there is
// none of, 1 for one refused, with why.
eq("an unknown command: RC 2", await run('ADDRESS CHESS "castle"\nSAY RC RESULT'), ["2 Unknown command: castle"]);
eq("a move with no to: RC 1, the old message", await run('ADDRESS CHESS "move from=e2"\nSAY RC RESULT'), ["1 from and to parameters required (e.g., from=e2 to=e4)"]);
c.run("game.new");
eq("a command line of commands.ts works too", await run('ADDRESS CHESS "game.move san=Nf3"\nSAY RC RESULT\nADDRESS CHESS "game.move san=Nf3"\nSAY RC RESULT'), ["0 Nf3", "1 Nf3 is not a legal move for black"]);

// A game is a program: the recorder's script (GAMESCRIPT) played on a new
// game gives the same position, a promotion and a set-up start included.
const rec = new Commands();
for (const t of ["e4", "d5", "exd5", "Nf6", "Bb5+", "c6"]) rec.run(`game.move san=${t}`);
const recorded = String(rec.run("game.script").output);
eq("the recorder's script", recorded.split("\n").slice(0, 4), ["/* A game, recorded by the chess app: run it to play it again */", "r = NEWGAME()", 'r = MOVE("e2", "e4")   /* 1. e4 */', 'r = MOVE("d7", "d5")   /* 1... d5 */']);
const replay = new Commands();
replay.run("game.move san=a4");
eq("run on another game, the same position", [(await replay.script(recorded, () => {})).ok, replay.game.fen(), replay.game.sanList()], [true, rec.game.fen(), rec.game.sanList()]);
const promo = new Commands();
promo.run('game.setPosition fen="7k/P7/8/8/8/8/8/K7 w - - 0 1"');
promo.run("game.move from=a7 to=a8 promotion=rook");
promo.run("game.resign");
const promoScript = String(promo.run("game.script").output);
eq("from a set position, a promotion and a resignation", promoScript.split("\n").slice(1, 4), ['r = SETPOSITION("7k/P7/8/8/8/8/8/K7 w - - 0 1")', 'r = MOVE("a7", "a8", "rook")   /* 1. a8=R+ */', 'r = RESIGN("black")']);
const promoReplay = new Commands();
eq("and replayed", [(await promoReplay.script(promoScript, () => {})).ok, promoReplay.game.fen(), promoReplay.game.result()], [true, promo.game.fen(), "1-0"]);

// CHESSCOMMAND: an ADDRESS CHESS line as a function, as the bus sends one.
c.run("game.new");
eq("CHESSCOMMAND runs an old line, and gives what it gave", [(await ask0('CHESSCOMMAND("move from=e2 to=e4")')).output, (await ask0('CHESSCOMMAND("get-position-fen")')).output],
  ["e4", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"]);
eq("its refusal is the request's error", (await ask0('CHESSCOMMAND("castle")')).message, "Unknown command: castle (nothing it did was kept)");

// The functions by name, in a program.
c.run("game.new");
eq("the functions by name", await run(`r = MOVE("e2", "e4")
r = MOVESAN("e5")
SAY GETTURN() GETFEN()
moves = GETMOVEHISTORYSAN()
SAY moves.0 moves.1 moves.2
SAY PIECEAT("e4") ISCHECK()
n = UNDO()
SAY n GETTURN()`), ["white rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", "2 e4 e5", "P 0", "2 white"]);
// (the script was one step, so UNDO() took both its moves back)
eq("a function's error ends the script, said", (await run('r = MOVE("e2", "e4")\nr = MOVE("e2", "e4")\nSAY "not reached"'))[0].startsWith("FAILED:"), true);

// A control-bus request: one step of undo, taken back whole when it fails.
c.run("game.new");
const ask = (code: string) => c.chess(code, () => {});
eq("a request's answer is what it came to", [(await ask('MOVE("e2", "e4")')).output, (await ask("GETTURN()")).output], ["e4", "black"]);
eq("a request of several moves is one step", [(await ask('MOVESAN("e5"); MOVESAN("Nf3"); MOVESAN("Nc6")')).ok, c.game.steps], [true, [1, 3]]);
const failed = await ask('MOVESAN("Bc4"); MOVESAN("Nf6"); BOGUS()');
eq("one that fails part way is taken back whole", [failed.ok, failed.message, c.game.sanList()], [false, "Function BOGUS is not available: See https://rexxjs.org/functions/missing/ for help with missing functions and REQUIRE. (nothing it did was kept)", ["e4", "e5", "Nf3", "Nc6"]]);
eq("and the undo step it would have made is not there", c.game.steps, [1, 3]);
eq("a request with a bad move: refused, said", (await ask('MOVE("e2", "e4")')).message, "e2 to e4 is not a legal move for white (nothing it did was kept)");
eq("RUN_PROGRAM: a whole program in one request, its SAY lines and RESULT", await ask('RUN_PROGRAM("r = UNDO(); SAY r; r = UNDO(); SAY r; LET RESULT = GETTURN()")'), { ok: true, message: "ran", output: { said: { 0: 2, 1: "3", 2: "1" }, result: "white" } });
eq("its two undos (a step of three moves, then one) are two steps of redo", [c.game.redoSteps.map((st) => st.length), c.game.sanList()], [[3, 1], []]);
eq("RUN_PROGRAM with the program as JSON, as the MCP server sends it", (await ask(`RUN_PROGRAM('${JSON.stringify("LET RESULT = GETTURN()")}', "json")`)).output, { said: { 0: 0 }, result: "white" });
c.run("game.move san=e4");
c.run("game.move san=e5");
// Stopped by sae (bus.serve's second function): "interrupted", the page's
// time limit stopped it, so it is taken back now; "deadline", still
// running at the bus's 10 s, so its next command fails and it is taken
// back then. The request runs on, as the interpreter does, while this
// test lets it make its first move and then stops it.
const LONG = 'x = RUN_PROGRAM("DO i = 1 TO 3000\nn = i\nEND")';
const untilMade = async (san: string) => {
  for (let i = 0; i < 100000 && !c.game.sanList().includes(san); i++) await Promise.resolve();
  return c.game.sanList().includes(san);
};
const interrupted = ask(`MOVESAN("Nf3"); ${LONG}; MOVESAN("Nc6")`);
eq("a request made its first move, then sae stopped it", await untilMade("Nf3"), true);
eq("interrupted: taken back now", [c.stopped("interrupted"), c.game.sanList(), c.stopped("interrupted")], ["taken back (nothing it did was kept)", ["e4", "e5"], ""]);
eq("if it runs on, its next command is refused and nothing of it is kept", [(await interrupted).message, c.game.sanList()], ["the request was stopped", ["e4", "e5"]]);
const late = ask(`MOVESAN("Nf3"); ${LONG}; MOVESAN("Nc6")`);
eq("another made its first move", await untilMade("Nf3"), true);
eq("deadline: cancelled, its next command fails, and it is taken back", [c.stopped("deadline"), (await late).message, c.game.sanList(), c.game.steps], ["cancelled", "the request was stopped (nothing it did was kept)", ["e4", "e5"], [1, 1]]);
eq("and after it, a request is one step as before", [(await ask('MOVESAN("Nf3"); MOVESAN("Nc6")')).ok, c.game.steps], [true, [1, 1, 2]]);

// expect: ok the quick start
// expect: ok the whole script was one step of undo
// expect: ok example 1
// expect: ok example 2
// expect: ok example 3
// expect: ok example 4
// expect: ok example 5 runs through its four levels
// expect: ok set-ai-difficulty with the level given
// expect: ok an unknown command: RC 2
// expect: ok a move with no to: RC 1, the old message
// expect: ok a command line of commands.ts works too
// expect: ok the recorder's script
// expect: ok run on another game, the same position
// expect: ok from a set position, a promotion and a resignation
// expect: ok and replayed
// expect: ok CHESSCOMMAND runs an old line, and gives what it gave
// expect: ok its refusal is the request's error
// expect: ok the functions by name
// expect: ok a function's error ends the script, said
// expect: ok a request's answer is what it came to
// expect: ok a request of several moves is one step
// expect: ok one that fails part way is taken back whole
// expect: ok and the undo step it would have made is not there
// expect: ok a request with a bad move: refused, said
// expect: ok RUN_PROGRAM: a whole program in one request, its SAY lines and RESULT
// expect: ok its two undos (a step of three moves, then one) are two steps of redo
// expect: ok RUN_PROGRAM with the program as JSON, as the MCP server sends it
// expect: ok a request made its first move, then sae stopped it
// expect: ok interrupted: taken back now
// expect: ok if it runs on, its next command is refused and nothing of it is kept
// expect: ok another made its first move
// expect: ok deadline: cancelled, its next command fails, and it is taken back
// expect: ok and after it, a request is one step as before
