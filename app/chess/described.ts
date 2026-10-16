// Every function a script and the control bus may call (LISTCOMMANDS()),
// described: its parameters, what it does and what it gives. Read by
// LISTCOMMANDS(1) (control.ts), so a program driving the app (the MCP server
// in mcp/, a REXX script) learns how to call each one, not just its name;
// and CHESS_COMMANDS.md is generated from it (tools/gen-commands.mjs), so
// the two cannot drift. tests/headless/chess_described.ts holds this to the
// functions themselves: every name listed, and each one's parameters as
// many as it takes.

// What an argument is, as the functions read it (control.ts):
//   square   a square, "e4"
//   san      a move in standard algebraic notation, "Nf3", "O-O", "exd5", "e8=Q"
//   fen      a position in FEN, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
//   piece    a promotion piece: queen, rook, bishop or knight (or q, r, b, n)
//   side     white or black (for the computer player: white, black, both or none)
//   level    the computer player's level, 1 to 4
//   text     any text
//   number   a number
//   flag     1 for yes, 0 for no
//   json     JSON, as text
//   stem     a REXX stem (list.0 = how many, list.1, list.2, ...)
export type ParamType = "square" | "san" | "fen" | "piece" | "side" | "level" | "text" | "number" | "flag" | "json" | "stem";

export interface Param {
  readonly name: string;
  readonly type: ParamType;
  readonly optional?: true;
  readonly variadic?: true;   // the rest of the arguments
  readonly about?: string;
}

export interface Described {
  readonly params: readonly Param[];
  readonly does: string;
  readonly gives: string;
}

const p = (name: string, type: ParamType, about?: string): Param => (about ? { name, type, about } : { name, type });
const opt = (name: string, type: ParamType, about?: string): Param => ({ ...p(name, type, about), optional: true });
const fn = (params: Param[], does: string, gives: string): Described => ({ params, does, gives });

export const DESCRIBED: Readonly<Record<string, Described>> = {
  // ---- moves
  MOVE: fn([p("from", "square"), p("to", "square"), opt("promotion", "piece", "queen if left out, when the move promotes")], "Makes a move, from a square to a square, for the side to move", "the move in SAN, e.g. \"Nf3\" or \"e8=Q+\""),
  MOVESAN: fn([p("move", "san", "or coordinate notation, \"e2e4\", \"e7e8q\"")], "Makes a move named in algebraic notation", "the move in SAN"),
  UNDO: fn([], "Takes back the last move (or the moves one request made, as one)", "how many moves came back, 0 for none"),
  REDO: fn([], "Makes again the last move taken back", "how many moves went back on, 0 for none"),
  NEWGAME: fn([], "Starts a new game from the usual position; the settings stay", "\"OK\""),
  SETPOSITION: fn([p("fen", "fen")], "Sets up a position; the game starts from it", "the position's FEN, as the app writes it"),
  RESIGN: fn([opt("side", "side", "the side to move if left out")], "Resigns; the game is over", "the result, \"1-0\" or \"0-1\""),
  OFFERDRAW: fn([], "Offers a draw, which is agreed (no one declines yet); the game is over", "\"1/2-1/2\""),
  // ---- reading the game
  GETBOARD: fn([], "The board as a diagram, white at the bottom: the Unicode pieces, \".\" for an empty square", "ten lines of text"),
  GETFEN: fn([], "The position", "its FEN"),
  GETMOVES: fn([], "The legal moves for the side to move, in coordinate notation", "a stem of \"e2e4\", \"e7e8q\", ..."),
  LISTLEGALMOVES: fn([], "The legal moves for the side to move, each described", "a stem of {from, to, piece, capture, promotion, san, coordinate}"),
  GETSTATUS: fn([], "Where the game is", "{status, toPlay, isCheck, legalMoves, result}: status in_progress, check, checkmate, stalemate, fifty_move_draw, threefold_repetition_draw, insufficient_material_draw, resigned or draw_agreed"),
  GETMOVEHISTORY: fn([], "The moves made so far, in coordinate notation", "a stem of \"e2e4\", \"e7e5\", ..."),
  GETMOVEHISTORYSAN: fn([], "The moves made so far, in SAN", "a stem of \"e4\", \"e5\", ..."),
  GETGAMEINFO: fn([], "Everything about the game at once", "{status, toPlay, isCheck, legalMoveCount, halfMoveClock, fullMoveNumber, result, fen, lastMove, moves, canUndo, canRedo, aiLevel, aiSide, flipped, board}"),
  GOTOMOVE: fn([p("ply", "number", "how many moves in: 0 for the start, 1 after white's first, 2 after black's, ...")],
    "Goes to a move of the game, by undo or redo (a request's moves stay together); the moves after it can be redone", "how many moves are made now"),
  GETCAPTURED: fn([], "The pieces taken since the start position, and the material balance (pawn 1, knight and bishop 3, rook 5, queen 9)",
    "{white: the FEN letters of the black pieces white has taken, black: the white pieces black has taken, balance: above 0 when white is ahead}"),
  GAMESCRIPT: fn([], "The game as a REXX program that plays it again: NEWGAME() (or SETPOSITION of where it started), then a MOVE line a move",
    "the program's text, a line a move"),
  EXPORTGAME: fn([], "The game as its file (what Save writes): where it started, its moves, who the computer plays, its level, the flip",
    "the file's JSON: {format: \"sae-chess-game\", version: 1, start, moves, aiLevel, aiSide, flipped}"),
  IMPORTGAME: fn([p("file", "json", "a game file, as EXPORTGAME gives one")], "Opens a game from its file's JSON, in place of this one (what Open reads)", "how many moves it has"),
  GETTURN: fn([], "Whose move it is", "\"white\" or \"black\""),
  GETRESULT: fn([], "The result", "\"1-0\", \"0-1\", \"1/2-1/2\", or \"*\" while the game goes on"),
  PIECEAT: fn([p("square", "square")], "What stands on a square", "its FEN letter: K Q R B N P for white, k q r b n p for black, \"\" for none"),
  ISCHECK: fn([], "Whether the side to move is in check", "1 or 0"),
  // ---- the computer player, the board
  SETAIDIFFICULTY: fn([p("level", "level")], "Sets the computer player's level: how many half-moves it looks ahead (then the captures that follow)", "the level"),
  GETAIDIFFICULTY: fn([], "The computer player's level", "1 to 4"),
  SETAISIDE: fn([p("side", "side", "white, black, both or none")], "Which side the computer plays", "the side"),
  AIMOVE: fn([], "The computer makes a move for the side to move, at its level (SETAIDIFFICULTY): one step of undo; the same position at the same level gives the same move", "the move in SAN"),
  FLIPBOARD: fn([], "Turns the board round: black at the bottom, or white again", "1 when black is at the bottom, else 0"),
  BOARDSIZE: fn([opt("px", "number", "240 to 960; left out: the size it is")], "Sets the board's size on the page, in pixels; it stays square as the window changes", "the size, in pixels"),
  DARKMODE: fn([opt("on", "flag", "1: dark, 0: light; left out: the other one")], "The page's dark look, or the light", "1 when dark, else 0"),
  // ---- the app
  CHESS_VERSION: fn([], "The app's version", "e.g. \"sae chess\""),
  LISTCOMMANDS: fn([opt("described", "flag", "1: each with its parameters, what it does and what it gives")], "The functions a script may call", "a stem of names, or of {name, signature, params, does, gives}"),
  BATCH_EXECUTE: fn([p("commands", "stem", "of {command, args}; or their JSON"), opt("stop", "flag", "1: the first that fails is the call's error (a control-bus request is then taken back whole)")],
    "Runs each command in turn, by name", "a JSON array of {index, command, success, result or error}"),
  CHESSCOMMAND: fn([p("line", "text", "an ADDRESS CHESS line: \"move from=e2 to=e4\", \"get-board\", or a command such as \"game.move san=Nf3\"")],
    "Runs one ADDRESS CHESS line, as a script's ADDRESS CHESS does (the control bus, whose requests are expressions, reaches the old commands so)", "what the line gives; its refusal is the error"),
  RUN_PROGRAM: fn([p("program", "text", "a whole REXX program: lines, loops, routines"), opt("encoding", "text", "\"json\": the program is a JSON string")],
    "Runs a whole program with these same functions, as one step of undo, taken back whole if it fails", "{said: a stem of its SAY lines, result: its RESULT}"),
};

// "MOVE(from, to, [promotion])": optional parameters in brackets, the rest as ...
export function signature(name: string, d: Described): string {
  return `${name}(${d.params.map((x) => (x.variadic ? `[${x.name}...]` : x.optional ? `[${x.name}]` : x.name)).join(", ")})`;
}
