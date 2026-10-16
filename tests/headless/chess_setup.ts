// app/chess/setup.ts (TODO.md 5.2): a board set up square by square as a
// FEN: the squares of a FEN read back, the start position round the
// circle, castling rights where king and rook stand at home, black to
// move; the game set to it, and a set-up that is no position refused with
// the reason.
import { START_FEN } from "./chess/parser.ts";
import { START_PIECES, fenOf, piecesOfFen } from "./chess/setup.ts";
import { Commands } from "./chess/commands.ts";
import { eq } from "./lib/check.ts";

eq("the start's squares: a1 a rook, e1 the king, e8 the black king, e4 empty", [START_PIECES[0], START_PIECES[4], START_PIECES[60], START_PIECES[28]], ["R", "K", "k", ""]);
eq("and back to its FEN", fenOf(START_PIECES, "w"), START_FEN);
const board: string[] = new Array(64).fill("");
board[4] = "K";
board[60] = "k";
board[3] = "Q";
eq("kings and a queen, black to move: no castling", fenOf(board, "b"), "4k3/8/8/8/8/8/8/3QK3 b - - 0 1");
board[7] = "R";
board[56] = "r";
eq("a rook at home beside its king at home: that castling right", fenOf(board, "w"), "r3k3/8/8/8/8/8/8/3QK2R w Kq - 0 1");
eq("a FEN's squares read back", fenOf(piecesOfFen("r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"), "w"), "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1");

const c = new Commands();
eq("the game set to a set-up", c.run(`game.setPosition fen="${fenOf(board, "b")}"`).message, "the position is set: black to move");
const noKing = new Array(64).fill("");
noKing[4] = "K";
eq("a set-up with one king is refused, saying why", c.run(`game.setPosition fen="${fenOf(noKing, "w")}"`).message, "FEN: one king each, not 1 white and 0 black");

// expect: ok the start's squares: a1 a rook, e1 the king, e8 the black king, e4 empty
// expect: ok and back to its FEN
// expect: ok kings and a queen, black to move: no castling
// expect: ok a rook at home beside its king at home: that castling right
// expect: ok a FEN's squares read back
// expect: ok the game set to a set-up
// expect: ok a set-up with one king is refused, saying why
