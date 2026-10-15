// app/chess/control.ts: the control functions, each over the commands:
// the old app's 12 ADDRESS CHESS commands by their new names (MOVE,
// GETBOARD, GETMOVES, UNDO, REDO, NEWGAME, SETAIDIFFICULTY, GETSTATUS,
// GETMOVEHISTORY, GETFEN, LISTLEGALMOVES, GETGAMEINFO) and the rest, a
// refusal as the function's error, LISTCOMMANDS and BATCH_EXECUTE.
import { Commands } from "./chess/commands.ts";
import { CONTROL, boardOf, controlFunctions } from "./chess/control.ts";
import { START_FEN } from "./chess/parser.ts";
import { eq, throws } from "./lib/check.ts";

const cmds = new Commands();
const fns = controlFunctions((id, params) => cmds.execute(id, params), cmds.game, {});
const unstem = (s: any) => Array.from({ length: Number(s[0]) }, (_, i) => s[i + 1]);

eq("MOVE gives the SAN", [fns.MOVE("e2", "e4"), fns.MOVE("c7", "c5"), fns.MOVESAN("Nf3")], ["e4", "c5", "Nf3"]);
throws("a move that is not legal is the function's error", () => fns.MOVE("e4", "e6"), Error, "e4 to e6 is not a legal move for black");
throws("a square that is none", () => fns.MOVE("e9", "e4"), Error, 'MOVE needs a square (e.g. "e4"), not "e9"');
eq("GETBOARD, as the old get-board drew it", boardOf(cmds.game), [
  "  a b c d e f g h",
  "8 ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜ 8",
  "7 ♟ ♟ . ♟ ♟ ♟ ♟ ♟ 7",
  "6 . . . . . . . . 6",
  "5 . . ♟ . . . . . 5",
  "4 . . . . ♙ . . . 4",
  "3 . . . . . ♘ . . 3",
  "2 ♙ ♙ ♙ ♙ . ♙ ♙ ♙ 2",
  "1 ♖ ♘ ♗ ♕ ♔ ♗ . ♖ 1",
  "  a b c d e f g h"].join("\n"));
eq("GETBOARD is the same through the function", fns.GETBOARD(), boardOf(cmds.game));
eq("GETFEN", fns.GETFEN(), "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2");
eq("GETMOVES: a stem of coordinate moves", [unstem(fns.GETMOVES()).length, unstem(fns.GETMOVES()).slice(0, 3)], [22, ["a7a5", "b7b5", "d7d5"]]);
const legal = unstem(fns.LISTLEGALMOVES());
eq("LISTLEGALMOVES: each described", legal.find((m: any) => m.coordinate === "d7d5"), { from: "d7", to: "d5", piece: "P", capture: 0, promotion: "", san: "d5", coordinate: "d7d5" });
eq("GETSTATUS", fns.GETSTATUS(), { status: "in_progress", toPlay: "black", isCheck: 0, legalMoves: 22, result: "*" });
eq("GETMOVEHISTORY, and in SAN", [unstem(fns.GETMOVEHISTORY()), unstem(fns.GETMOVEHISTORYSAN())], [["e2e4", "c7c5", "g1f3"], ["e4", "c5", "Nf3"]]);
const info: any = fns.GETGAMEINFO();
eq("GETGAMEINFO", [info.status, info.toPlay, info.isCheck, info.legalMoveCount, info.halfMoveClock, info.fullMoveNumber, info.result, info.lastMove, unstem(info.moves), info.canUndo, info.canRedo, info.aiLevel, info.aiSide, info.flipped, info.board === boardOf(cmds.game)],
  ["in_progress", "black", 0, 22, 1, 2, "*", "g1f3", ["e4", "c5", "Nf3"], 1, 0, 2, "none", 0, true]);
eq("GETTURN, GETRESULT, PIECEAT, ISCHECK", [fns.GETTURN(), fns.GETRESULT(), fns.PIECEAT("e4"), fns.PIECEAT("c5"), fns.PIECEAT("E1"), fns.PIECEAT("d4"), fns.ISCHECK()], ["black", "*", "P", "p", "K", "", 0]);
throws("PIECEAT of no square", () => fns.PIECEAT("z9"), Error, 'PIECEAT needs a square (e.g. "e4"), not "z9"');
eq("UNDO gives how many moves came back; REDO too", [fns.UNDO(), fns.GETFEN() === "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2", fns.REDO(), fns.UNDO(), fns.UNDO(), fns.UNDO(), fns.UNDO()], [1, true, 1, 1, 1, 1, 0]);
eq("NEWGAME", [fns.NEWGAME(), fns.GETFEN()], ["OK", START_FEN]);
eq("SETPOSITION gives the FEN as the app writes it", fns.SETPOSITION("7k/P7/8/8/8/8/8/K7 w - - 0 1"), "7k/P7/8/8/8/8/8/K7 w - - 0 1");
throws("a FEN that is none", () => fns.SETPOSITION("x"), Error, "FEN: 2 to 6 fields, not 1");
eq("MOVE with a promotion", [fns.MOVE("a7", "a8", "rook"), fns.ISCHECK(), fns.GETSTATUS().status], ["a8=R+", 1, "check"]);
eq("MOVESAN with coordinate notation", [fns.MOVESAN("h8h7"), fns.MOVESAN("a8a7")], ["Kh7", "Ra7+"]);
eq("RESIGN gives the result", [fns.RESIGN(), fns.GETRESULT(), fns.GETSTATUS().status], ["1-0", "1-0", "resigned"]);
throws("no move after the end", () => fns.MOVESAN("Kg6"), Error, "the game is over (resigned, 1-0)");
fns.UNDO();
eq("RESIGN with a side; OFFERDRAW", [fns.RESIGN("white"), fns.UNDO(), fns.OFFERDRAW()], ["0-1", 1, "1/2-1/2"]);
eq("the computer player's settings; AIMOVE until stage 4", [fns.SETAIDIFFICULTY(3), fns.GETAIDIFFICULTY(), fns.SETAISIDE("black")], [3, 3, "black"]);
throws("a level that is none", () => fns.SETAIDIFFICULTY(7), Error, "7 is not a level (1 to 4)");
fns.NEWGAME();
throws("AIMOVE until stage 4", () => fns.AIMOVE(), Error, "no computer player yet (stage 4 of TODO.md)");
eq("FLIPBOARD", [fns.FLIPBOARD(), fns.FLIPBOARD()], [1, 0]);
eq("CHESS_VERSION", fns.CHESS_VERSION(), "sae chess");

// LISTCOMMANDS and BATCH_EXECUTE.
const names: string[] = unstem(fns.LISTCOMMANDS()) as string[];
eq("LISTCOMMANDS lists every control function, LISTCOMMANDS and BATCH_EXECUTE", [names.length, names.includes("MOVE"), names.includes("LISTCOMMANDS"), names.includes("BATCH_EXECUTE")], [Object.keys(CONTROL).length + 2, true, true, true]);
eq("LISTCOMMANDS(1) describes MOVE", unstem(fns.LISTCOMMANDS(1)).find((d: any) => d.name === "MOVE").signature, "MOVE(from, to, [promotion])");
const batch = JSON.parse(await fns.BATCH_EXECUTE([{ command: "move", args: ["e2", "e4"] }, { command: "MOVESAN", args: ["Qh9"] }, { command: "GETTURN" }, { command: "NOPE" }]));
eq("BATCH_EXECUTE: each in turn, a failure not stopping the rest", batch.map((r: any) => [r.command, r.success, r.result ?? r.error]), [["MOVE", true, "e4"], ["MOVESAN", false, "Qh9 is not a legal move for black"], ["GETTURN", true, "black"], ["NOPE", false, "Unknown command: NOPE"]]);
let stopped = "";
try { await fns.BATCH_EXECUTE('[{"command": "MOVESAN", "args": ["e5"]}, {"command": "MOVESAN", "args": ["e5"]}, {"command": "MOVESAN", "args": ["Nf3"]}]', 1); } catch (e) { stopped = (e as Error).message; }
eq("with stop, the first failure is the call's error, and the rest are not run", [stopped, unstem(fns.GETMOVEHISTORYSAN())], ["command 2 (MOVESAN): e5 is not a legal move for white", ["e4", "e5"]]);

// expect: ok MOVE gives the SAN
// expect: ok a move that is not legal is the function's error
// expect: ok a square that is none
// expect: ok GETBOARD, as the old get-board drew it
// expect: ok GETBOARD is the same through the function
// expect: ok GETFEN
// expect: ok GETMOVES: a stem of coordinate moves
// expect: ok LISTLEGALMOVES: each described
// expect: ok GETSTATUS
// expect: ok GETMOVEHISTORY, and in SAN
// expect: ok GETGAMEINFO
// expect: ok GETTURN, GETRESULT, PIECEAT, ISCHECK
// expect: ok PIECEAT of no square
// expect: ok UNDO gives how many moves came back; REDO too
// expect: ok NEWGAME
// expect: ok SETPOSITION gives the FEN as the app writes it
// expect: ok a FEN that is none
// expect: ok MOVE with a promotion
// expect: ok MOVESAN with coordinate notation
// expect: ok RESIGN gives the result
// expect: ok no move after the end
// expect: ok RESIGN with a side; OFFERDRAW
// expect: ok the computer player's settings; AIMOVE until stage 4
// expect: ok a level that is none
// expect: ok AIMOVE until stage 4
// expect: ok FLIPBOARD
// expect: ok CHESS_VERSION
// expect: ok LISTCOMMANDS lists every control function, LISTCOMMANDS and BATCH_EXECUTE
// expect: ok LISTCOMMANDS(1) describes MOVE
// expect: ok BATCH_EXECUTE: each in turn, a failure not stopping the rest
// expect: ok with stop, the first failure is the call's error, and the rest are not run
