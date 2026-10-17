// app/chess/speak.ts (TODO.md 6.6): the board in words for a screen
// reader: a square and its piece, a move as it is said (a capture, en
// passant, castling, a promotion, check and mate), the position rank by
// rank, the cursor's step across the board as it is shown (flipped too);
// the view.cursor command, and CURSOR, DESCRIBESQUARE and DESCRIBEBOARD.
import { pieceName, squareText, moveText, boardText, stepFrom } from "./chess/speak.ts";
import { START_PIECES, piecesOfFen } from "./chess/setup.ts";
import { getIndexFromAlgebraic as sq } from "./chess/chess.ts";
import { Commands } from "./chess/commands.ts";
import { controlFunctions } from "./chess/control.ts";
import { eq, throws } from "./lib/check.ts";

eq("a piece by its colour and name", [pieceName("N"), pieceName("p"), pieceName("K"), pieceName("")], ["white knight", "black pawn", "white king", ""]);
eq("a square and what stands on it", [squareText(START_PIECES, sq("e2")), squareText(START_PIECES, sq("g8")), squareText(START_PIECES, sq("e4"))],
  ["e2, white pawn", "g8, black knight", "e4, empty"]);
eq("a move", moveText(START_PIECES, "e2e4", "e4"), "e2 to e4");
const scotch = piecesOfFen("r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3");
eq("a capture says what it took", moveText(scotch, "e5d4", "exd4"), "e5 to d4, takes white pawn");
const passant = piecesOfFen("rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3");
eq("en passant: the pawn beside", moveText(passant, "e5f6", "exf6"), "e5 to f6, takes black pawn en passant");
const castle = piecesOfFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
eq("castling, either way", [moveText(castle, "e1g1", "O-O"), moveText(castle, "e1c1", "O-O-O+")], ["e1 to g1, castles kingside", "e1 to c1, castles queenside, check"]);
const promote = piecesOfFen("1n5k/P7/8/8/8/8/8/K7 w - - 0 1");
eq("a promotion, taking, with check", moveText(promote, "a7b8q", "axb8=Q+"), "a7 to b8, takes black knight, becomes a queen, check");
eq("and an under-promotion", moveText(promote, "a7a8n", "a8=N"), "a7 to a8, becomes a knight");
const mate = piecesOfFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
eq("mate", moveText(mate, "a1a8", "Ra8#"), "a1 to a8, checkmate");
eq("the board rank by rank", boardText(piecesOfFen("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1")),
  "8: e8 black king; 7: empty; 6: empty; 5: empty; 4: empty; 3: empty; 2: e2 white pawn; 1: e1 white king");
eq("the start's first rank", boardText(START_PIECES).split("; ")[7], "1: a1 white rook, b1 white knight, c1 white bishop, d1 white queen, e1 white king, f1 white bishop, g1 white knight, h1 white rook");
eq("a step across the board: up is up the ranks for white", [stepFrom(sq("e2"), "up", false), stepFrom(sq("e2"), "left", false), stepFrom(sq("e2"), "right", false), stepFrom(sq("e2"), "down", false)].map(String),
  [sq("e3"), sq("d2"), sq("f2"), sq("e1")].map(String));
eq("flipped, up the screen is down the ranks, left is towards h", [stepFrom(sq("e2"), "up", true), stepFrom(sq("e2"), "left", true)], [sq("e1"), sq("f2")]);
eq("the edge holds", [stepFrom(sq("a1"), "left", false), stepFrom(sq("h8"), "up", false), stepFrom(sq("a1"), "up", true)], [sq("a1"), sq("h8"), sq("a1")]);

const c = new Commands();
eq("the cursor starts on e2, not shown", [c.game.cursor, c.execute("game.state").output && (c.execute("game.state").output as any).cursor], [sq("e2"), -1]);
eq("view.cursor by= steps it, and gives the square", c.run("view.cursor by=up").message, "e3, empty");
eq("shown from then on", (c.execute("game.state").output as any).cursor, sq("e3"));
eq("square= puts it on a square", c.run("view.cursor square=g8").output, "g8, black knight");
eq("a refusal for what is no square, or no step", [c.run("view.cursor square=z9").message, c.run("view.cursor by=sideways").message],
  ["z9 is not a square (a1 to h8)", "sideways is not a step (up, down, left or right)"]);
eq("the cursor is not a move: nothing to undo", c.game.canUndo(), false);
const fns = controlFunctions((id, params) => c.execute(id, params), c.game, {});
eq("CURSOR() where it is, CURSOR(\"down\"), CURSOR(\"E2\")", [fns.CURSOR(), fns.CURSOR("down"), fns.CURSOR("E2")], ["g8, black knight", "g7, black pawn", "e2, white pawn"]);
throws("CURSOR of what is neither", () => fns.CURSOR("e9"), Error, 'CURSOR needs a square (e.g. "e4"), not "e9"');
fns.MOVE("e2", "e4");
eq("DESCRIBESQUARE after a move", [fns.DESCRIBESQUARE("e4"), fns.DESCRIBESQUARE("e2")], ["e4, white pawn", "e2, empty"]);
eq("DESCRIBEBOARD", String(fns.DESCRIBEBOARD()).split("; ")[4], "4: e4 white pawn");
fns.FLIPBOARD();
eq("CURSOR's steps follow the flip", [fns.CURSOR("e4"), fns.CURSOR("up")], ["e4, white pawn", "e3, empty"]);

// expect: ok a piece by its colour and name
// expect: ok a square and what stands on it
// expect: ok a move
// expect: ok a capture says what it took
// expect: ok en passant: the pawn beside
// expect: ok castling, either way
// expect: ok a promotion, taking, with check
// expect: ok and an under-promotion
// expect: ok mate
// expect: ok the board rank by rank
// expect: ok the start's first rank
// expect: ok a step across the board: up is up the ranks for white
// expect: ok flipped, up the screen is down the ranks, left is towards h
// expect: ok the edge holds
// expect: ok the cursor starts on e2, not shown
// expect: ok view.cursor by= steps it, and gives the square
// expect: ok shown from then on
// expect: ok square= puts it on a square
// expect: ok a refusal for what is no square, or no step
// expect: ok the cursor is not a move: nothing to undo
// expect: ok CURSOR() where it is, CURSOR("down"), CURSOR("E2")
// expect: ok CURSOR of what is neither
// expect: ok DESCRIBESQUARE after a move
// expect: ok DESCRIBEBOARD
// expect: ok CURSOR's steps follow the flip
